import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

// 幣別到市場代號的映射
const mapCurrencyToMarket = (currency) => {
  const mapping = { 'TWD': 'TW', 'CNY': 'CN', 'USD': 'US', 'HKD': 'HK', 'JPY': 'JP' };
  return mapping[currency] || 'TW';
};

const AddAccountModal = ({ isOpen, onClose, onAccountAdded }) => {
  const [accountName, setAccountName] = useState('');
  const [currency, setCurrency] = useState('TWD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 當打開 Modal 時重置狀態
  useEffect(() => {
    if (isOpen) {
      setAccountName('');
      setCurrency('TWD');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!accountName.trim()) {
      setError('請輸入帳戶名稱');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('尚未登入');

      const market = mapCurrencyToMarket(currency);

      const { error: insertError } = await supabase
        .from('accounts')
        .insert([{
          user_id: user.id,
          account_name: accountName,
          currency,
          market,
          balance: 0,
          daily_pnl: 0,
          daily_pnl_percent: '0.00',
          last_balance: 0,
          total_pnl: 0
        }]);

      if (insertError) throw insertError;

      onAccountAdded();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
          {/* 1. 背景遮罩：參考 ManageGroupsModal 的全螢幕模糊 */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            onClick={onClose}
          />

          {/* 2. 彈窗主體：參考 ManageGroupsModal 的容器樣式 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative inset-0 z-[2000] w-full max-w-[360px] !rounded-[28px] flex flex-col bg-[rgba(28,28,30,0.6)] backdrop-blur-[30px] backdrop-saturate-[150%] shadow-[inset_0.5px_0.5px_0px_rgba(255,255,255,0.12)] border border-white/10 pointer-events-auto"
          >
            {/* 標題欄位 */}
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-[19px] font-bold text-white tracking-tight">新增資金帳戶</h3>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white"
              >
                <motion.svg 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  className="w-4 h-4 stroke-current stroke-[2.5]"
                  // 新增動畫邏輯：旋轉 180 度
                  animate={{ rotate: 180 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                >
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </motion.svg>
              </button>
            </div>

            {/* 表單內容 */}
            <div className="p-6 space-y-6">
              {/* 帳戶名稱 */}
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-[#8E8E93] ml-1 uppercase tracking-wider">
                  帳戶名稱
                </label>
                <input 
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="例如：新台幣帳戶"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white placeholder:text-white/20 focus:outline-none focus:border-[#0A84FF] transition-all text-[16px]"
                />
              </div>

              {/* 幣別選擇 */}
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-[#8E8E93] ml-1 uppercase tracking-wider">
                  帳戶幣別
                </label>
                <div className="relative">
                  <select 
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none appearance-none cursor-pointer text-[16px]"
                  >
                    <option value="TWD" className="bg-[#1C1C1E]">新台幣 (TWD)</option>
                    <option value="CNY" className="bg-[#1C1C1E]">人民幣 (CNY)</option>
                    <option value="USD" className="bg-[#1C1C1E]">美金 (USD)</option>
                    <option value="HKD" className="bg-[#1C1C1E]">港幣 (HKD)</option>
                    <option value="JPY" className="bg-[#1C1C1E]">日圓 (JPY)</option>
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-white/20">
                    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 stroke-current stroke-[3]">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-[#FF453A] text-[13px] font-medium text-center bg-[#FF453A]/10 py-2 rounded-xl">
                  {error}
                </div>
              )}
            </div>

            {/* 底部按鈕區 */}
            <div className="p-6 pt-0">
              <motion.button 
                whileTap={{ scale: 0.96 }}
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-[#0A84FF] hover:bg-[#007AFF] active:scale-95 transition-all text-white text-[17px] font-bold py-4 rounded-2xl shadow-lg shadow-[#0A84FF]/20 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  '確認建立帳戶'
                )}
              </motion.button>
              
              <button 
                onClick={onClose}
                className="w-full mt-2 text-white/40 text-[15px] font-medium py-3 hover:text-white transition-colors"
              >
                取消
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddAccountModal;