import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase'; 
import AddAccountModal from '../Modals/AddAccountModal';
import useOutsideClick from '../../hooks/useOutsideClick';

export default function FinanceView() {
  const [dbAccounts, setDbAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetDividend, setTargetDividend] = useState(0); 
  const [loading, setLoading] = useState(true);

  // 編輯狀態
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempValue, setTempValue] = useState("");

  const pickerRef = useRef(null);
  useOutsideClick(pickerRef, () => setShowPicker(false));

  const activeAccount = dbAccounts.find(acc => acc.id === selectedAccountId);

  // 1. 獲取帳戶資料
  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('updated_at', { ascending: true });

      if (error) throw error;
      setDbAccounts(data || []);

      if (data && data.length > 0) {
        if (!selectedAccountId || !data.find(a => a.id === selectedAccountId)) {
          setSelectedAccountId(data[0].id);
        }
      } else {
        setSelectedAccountId(null);
      }
    } catch (err) {
      console.error('Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  // 2. 獲取該市場的目標設定
  const fetchTarget = useCallback(async () => {
    if (!activeAccount) return;
    try {
      const { data, error } = await supabase
        .from('stock_targets')
        .select('monthly_income_target')
        .eq('market', activeAccount.market)
        .maybeSingle(); 

      if (error) throw error;
      setTargetDividend(data?.monthly_income_target || 0);
    } catch (err) {
      console.error('Fetch target error:', err.message);
      setTargetDividend(0); 
    }
  }, [activeAccount]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    fetchTarget();
  }, [fetchTarget]);

  // 🌟 保存餘額同步
  const saveBalance = async () => {
    if (isNaN(tempValue) || tempValue === "") {
      setIsEditingBalance(false);
      return;
    }
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ balance: parseFloat(tempValue), updated_at: new Date() })
        .eq('id', activeAccount.id);
      if (error) throw error;
      fetchAccounts(); 
    } catch (err) {
      alert("更新餘額失敗：" + err.message);
    } finally {
      setIsEditingBalance(false);
    }
  };

  // 🌟 保存目標同步
  const saveTarget = async () => {
    if (isNaN(tempValue) || tempValue === "") {
      setIsEditingTarget(false);
      return;
    }
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('stock_targets')
        .upsert({ 
          user_id: userData.user?.id,
          market: activeAccount.market, 
          monthly_income_target: parseFloat(tempValue),
          target_currency: activeAccount.currency,
          updated_at: new Date() 
        }, { onConflict: 'market' });
      if (error) throw error;
      setTargetDividend(parseFloat(tempValue));
    } catch (err) {
      alert("目標設定失敗：" + err.message);
    } finally {
      setIsEditingTarget(false);
    }
  };

  const formatNum = (num) => Number(num || 0).toLocaleString();
  const getSymbol = (curr) => curr === 'CNY' ? '¥' : '$';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* 頂部區域 */}
      <div className="mb-8">
        <button 
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-2 ios-gray text-[14px] font-medium active:opacity-60 transition-all"
        >
          <span className={activeAccount ? "ios-gray" : "text-[#8E8E93]"}>
            {activeAccount ? activeAccount.account_name : '選擇或新增帳戶'}
          </span>
            <motion.svg 
              viewBox="0 0 24 24" 
              fill="none" 
              className="w-3.5 h-3.5 stroke-current stroke-[3] pointer-events-none flex-shrink-0"
             animate={{ rotate: showPicker ? 180 : 0 }}
             transition={{ duration: 0.2, ease: "easeInOut" }}
            >
             <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /> 
            </motion.svg>
        </button>

        <AnimatePresence>
          {showPicker && (
            <div className="fixed inset-0 z-[2000] flex items-start justify-start p-5">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/20"
                onClick={() => setShowPicker(false)}
              />
              <motion.div
                ref={pickerRef}
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative top-[150px] min-w-[200px] max-w-[300px] z-[2001] rounded-[24px] ios-dropdown-base py-2.5 backdrop-blur-[5px]"
              >
                <div className="py-2">
                  {dbAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setShowPicker(false);
                      }}
                      className="w-full flex items-center px-5 py-3.5 transition-all active:bg-white/10"
                    >
                      <div className="w-8 flex-shrink-0">
                        {selectedAccountId === acc.id && (
                          <motion.svg layoutId="check-icon" viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white">
                            <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </motion.svg>
                        )}
                      </div>
                      <span className={`text-[19px] tracking-tight ${selectedAccountId === acc.id ? 'text-white font-semibold' : 'text-white/80 font-medium'}`}>
                        {acc.account_name}
                      </span>
                    </button>
                  ))}
                  <div className="mx-5 h-[0.5px] bg-white/10 my-1" />
                  <button
                    onClick={() => {
                      setShowPicker(false);
                      setTimeout(() => setIsAddModalOpen(true), 100);
                    }}
                    className="w-full flex items-center px-5 py-3.5 active:bg-white/10 ios-tap-feedback"
                  >
                    <div className="w-8 flex-shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white/60">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <span className="text-[19px] tracking-tight text-white/80">新增資金帳戶</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {activeAccount ? (
        <div className="animate-in fade-in slide-in-from-bottom-1 duration-500">
          {/* 數據內容顯示區 */}
          <div className="mb-10 min-h-[100px]">
            {isEditingBalance ? (
              <div className="flex items-baseline gap-2">
                <span className="text-[32px] font-bold text-white/40">{getSymbol(activeAccount.currency)}</span>
                <input
                  autoFocus
                  type="number"
                  className="bg-transparent text-[56px] font-black tracking-tighter text-white outline-none w-full border-b border-[#0A84FF]"
                  value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                  onBlur={saveBalance}
                  onKeyDown={(e) => e.key === 'Enter' && saveBalance()}
                />
              </div>
            ) : (
              <div 
                className="inline-block cursor-pointer active:opacity-50 transition-opacity"
                onClick={() => { setTempValue(activeAccount.balance); setIsEditingBalance(true); }}
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[32px] font-bold text-white/40">{getSymbol(activeAccount.currency)}</span>
                  <h2 className="text-[56px] font-black tracking-tighter leading-tight text-white">
                    {formatNum(activeAccount.balance)}
                  </h2>
                </div>
                <p className={`text-[19px] font-bold ${Number(activeAccount.daily_pnl || 0) >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                  {Number(activeAccount.daily_pnl || 0) >= 0 ? '+' : ''}
                  {formatNum(activeAccount.daily_pnl)} ({activeAccount.daily_pnl_percent || '0.00'}%)
                </p>
              </div>
            )}
          </div>

          {/* 月領股息目標卡片 */}
          <div className="mb-12 p-6 rounded-[28px] bg-white/5 border border-white/5 relative overflow-hidden">
            <h3 className="text-[14px] font-bold text-[#8E8E93] uppercase tracking-widest mb-5">
              月領股息目標 ({activeAccount.market})
            </h3>
            
            {isEditingTarget ? (
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-bold text-white/40">{getSymbol(activeAccount.currency)}</span>
                <input
                  autoFocus
                  type="number"
                  className="bg-transparent text-[28px] font-bold text-white outline-none w-full border-b border-[#0A84FF]"
                  value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                  onBlur={saveTarget}
                  onKeyDown={(e) => e.key === 'Enter' && saveTarget()}
                />
              </div>
            ) : (
              <div 
                className="inline-flex items-baseline gap-2 cursor-pointer active:opacity-50 transition-opacity"
                onClick={() => { setTempValue(targetDividend); setIsEditingTarget(true); }}
              >
                <span className="text-[28px] font-bold text-white">
                  {getSymbol(activeAccount.currency)} {formatNum(targetDividend)}
                </span>
                <span className="text-[15px] text-[#8E8E93]">/ 每月</span>
              </div>
            )}

            {/* 進度條 */}
            <div className="mt-6 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${targetDividend > 0 ? Math.min((activeAccount.balance / (targetDividend * 12)) * 100, 100) : 0}%` }}
                className="h-full bg-[#34C759] shadow-[0_0_10px_rgba(52,199,89,0.3)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 py-8 border-t border-white/10">
            <div>
              <p className="text-[#8E8E93] text-[14px] font-semibold uppercase tracking-wider mb-1">昨日結餘</p>
              <p className="text-[20px] font-bold text-white/90">
                {getSymbol(activeAccount.currency)} {formatNum(activeAccount.last_balance)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[#8E8E93] text-[14px] font-semibold uppercase tracking-wider mb-1">累計收益</p>
              <p className={`text-[20px] font-extrabold ${Number(activeAccount.total_pnl || 0) >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                {Number(activeAccount.total_pnl || 0) >= 0 ? '+' : ''}
                {formatNum(activeAccount.total_pnl)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-24 flex flex-col items-center justify-center border border-white/5 bg-white/5 rounded-[32px] opacity-40">
          <p className="text-white text-[16px] font-medium italic">尚未選擇或建立帳戶</p>
        </div>
      )}

      <AddAccountModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAccountAdded={fetchAccounts}
      />
    </div>
  );
}