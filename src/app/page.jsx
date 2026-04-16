"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import useStockData from '../hooks/useStockData';

// 組件導入
import ManageGroupsModal from '../components/Modals/ManageGroupsModal';
import MarketDropdown from '../components/Common/MarketDropdown';
import MarketSelector from '../components/Common/MarketSelector';
import StockDetailModal from '../components/Modals/StockDetailModal';
import AddToGroupModal from '../components/Modals/AddToGroupModal';
import ActionMenu from '../components/ActionSheets/ActionMenu';

// 視圖組件導入
import StockListView from '../components/Views/StockListView';
import FinanceView from '../components/Views/FinanceView';
import SettingsView from '../components/Views/SettingsView';
import SearchPage from './search/page'; 

export default function StockApp() {
  const router = useRouter();
  const [activeView, setActiveView] = useState('stock'); 
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState('我的代號');
  const [isMarketMenuOpen, setIsMarketMenuOpen] = useState(false);
  const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedStockDetail, setSelectedStockDetail] = useState(null);
  const [selectedStockForGroups, setSelectedStockForGroups] = useState(null);
  const [deletingGroupId, setDeletingGroupId] = useState(null);
  const [localStocks, setLocalStocks] = useState([]);
  
  // 同步與提示狀態
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const isDraggingRef = useRef(false);
  const pendingStocksRef = useRef(null);

  const { stocks: fetchedStocks, loading, refresh } = useStockData(selectedMarket);

  // --- 自動刷新機制 (每 30 秒) ---
  useEffect(() => {
    const autoRefreshInterval = setInterval(() => {
      // 僅在股票視圖、非加載中、非拖拽時自動刷新
      if (activeView === 'stock' && !isDraggingRef.current && !loading) {
        refresh();
      }
    }, 30000);

    return () => clearInterval(autoRefreshInterval);
  }, [activeView, loading, refresh]);

  // --- Toast 自動消失 ---
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  // 監控數據變化
  useEffect(() => {
    if (fetchedStocks && !isDraggingRef.current) {
      const sorted = [...fetchedStocks].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      setLocalStocks(sorted);
    } else if (fetchedStocks && isDraggingRef.current) {
      pendingStocksRef.current = fetchedStocks;
    }
  }, [fetchedStocks]);

  // --- 手動觸發同步指令 ---
  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    
    try {
      // 加上超時控制，防止 fetch 永久掛起
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('/api/stock/trigger', { 
        method: 'POST',
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({ success: false, error: '解析 JSON 失敗' }));
      
      if (data.success) {
        setToast({ show: true, message: '同步指令已發送，預計 1 分鐘內更新', type: 'success' });
      } else {
        setToast({ show: true, message: '觸發失敗: ' + (data.error || '未知錯誤'), type: 'error' });
      }
    } catch (error) {
      const msg = error.name === 'AbortError' ? '請求超時' : '連線失敗';
      setToast({ show: true, message: msg, type: 'error' });
    } finally {
      // 確保最後一定會釋放按鈕狀態，防止頁面鎖死
      setIsSyncing(false);
    }
  };

  // --- 其他業務邏輯 ---
  const fetchGroups = useCallback(async () => {
    const { data } = await supabase.from('user_groups').select('*').order('created_at', { ascending: true });
    if (data && data.length > 0) setGroups(data);
    else setGroups([{ id: 'default', name: '我的代號' }]);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      fetchGroups();
    };
    init();
  }, [fetchGroups, router]);

  const handleAddGroup = useCallback(async (groupName) => {
    if (!groupName || groupName.trim() === '') return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('user_groups').insert([{ user_id: user.id, name: groupName.trim() }]);
    await fetchGroups();
  }, [fetchGroups]);

  const handleEditGroup = useCallback(async (groupId, newName) => {
    await supabase.from('user_groups').update({ name: newName.trim() }).eq('id', groupId);
    await fetchGroups();
  }, [fetchGroups]);

  const handleDeleteGroup = useCallback(async (groupId) => {
    setDeletingGroupId(groupId);
    await supabase.from('user_groups').delete().eq('id', groupId);
    await fetchGroups();
    setDeletingGroupId(null);
  }, [fetchGroups]);

  const handleReorder = useCallback(async (newOrder) => {
    isDraggingRef.current = true;
    setLocalStocks(newOrder);
    const updates = newOrder.map((stock, index) => ({ id: stock.id, sort_order: index }));
    await supabase.from('watchlist').upsert(updates);
    isDraggingRef.current = false;
  }, []);

  const handleDragStart = useCallback(() => { isDraggingRef.current = true; }, []);
  const handleDragEnd = useCallback(() => { 
    isDraggingRef.current = false;
    if (pendingStocksRef.current) {
      setLocalStocks(pendingStocksRef.current);
      pendingStocksRef.current = null;
    }
  }, []);

  const handleToggleStockInGroup = useCallback(async (stockId, groupName) => {
    const target = localStocks.find(s => s.id === stockId);
    let currentGroups = Array.isArray(target.group_name) ? target.group_name : [target.group_name || '我的代號'];
    let newGroups = currentGroups.includes(groupName) ? currentGroups.filter(g => g !== groupName) : [...currentGroups, groupName];
    await supabase.from('watchlist').update({ group_name: newGroups }).eq('id', stockId);
    refresh();
  }, [localStocks, refresh]);

  const handleDeleteStock = useCallback(async (stockId) => {
    setLocalStocks(prev => prev.filter(s => s.id !== stockId));
    await supabase.from('watchlist').delete().eq('id', stockId);
    setTimeout(() => refresh(), 300);
  }, [refresh]);

  const marketList = useMemo(() => groups.map(g => g.name), [groups]);

  return (
    <div className="min-h-screen bg-[#121212] text-white select-none overflow-hidden relative font-pingfang">
      
      {/* 🌟 iOS 質感 Toast 提示 */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 z-[5000] w-auto whitespace-nowrap px-4"
          >
            <div className={`px-4 py-2.5 rounded-2xl backdrop-blur-xl border flex items-center gap-2.5 shadow-2xl ${
              toast.type === 'success' ? 'bg-white/10 border-white/20' : 'bg-red-500/20 border-red-500/30'
            }`}>
              {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
              <span className="text-[14px] font-medium text-white/90">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {activeView !== 'search' ? (
          <motion.div 
            key="main-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 pt-14 pb-10 min-h-screen overflow-y-auto"
          >
            <header className="flex justify-between items-start mb-2">
              <div>
                <h1 className="text-[34px] font-bold tracking-tight text-white">
                  {activeView === 'stock' ? '股市' : activeView === 'finance' ? '資金' : '設定' }
                </h1>
                <p className="text-[#8E8E93] text-[15px] font-medium">
                  {new Date().getMonth() + 1}月{new Date().getDate()}日
                </p>
              </div>
              
              <div className="flex items-center gap-2 mt-2">
                <div className="ios-glass-capsule !rounded-full px-3 py-1.5 flex items-center gap-3">
                  {/* 手動同步按鈕 */}
                  <button 
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className={`ios-tap-feedback transition-opacity ${isSyncing ? 'opacity-40 cursor-not-allowed' : 'opacity-80'}`}
                  >
                    <RefreshCw className={`w-5 h-5 stroke-white stroke-[2.5] ${isSyncing ? 'animate-spin' : ''}`} />
                  </button>

                  <div className="w-[1px] h-4 bg-white/10" />

                  <button onClick={() => setActiveView('search')} className="ios-tap-feedback opacity-80">
                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-white stroke-[2.5]">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                  </button>

                  <div className="w-[1px] h-4 bg-white/10" />

                  <button className="ios-tap-feedback opacity-80" onClick={() => setIsActionMenuOpen(true)}>
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 fill-white">
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="5" r="2" />
                      <circle cx="12" cy="19" r="2" />
                    </svg>
                  </button>
                </div>
              </div>
            </header>

            {activeView === 'stock' && (
              <>
                <MarketSelector selectedMarket={selectedMarket} onClick={() => setIsMarketMenuOpen(true)} isMenuOpen={isMarketMenuOpen} />
                <main className="mt-4">
                  <StockListView 
                    loading={loading} 
                    localStocks={localStocks} 
                    handleReorder={handleReorder} 
                    handleDragStart={handleDragStart} 
                    handleDragEnd={handleDragEnd} 
                    setSelectedStockDetail={setSelectedStockDetail} 
                    setSelectedStockForGroups={setSelectedStockForGroups} 
                    handleDeleteStock={handleDeleteStock} 
                  />
                </main>
              </>
            )}

            {activeView === 'finance' && <FinanceView />}
            {activeView === 'settings' && <SettingsView />}
          </motion.div>
        ) : (
          <motion.div key="search-view" className="fixed inset-0 z-[2000] bg-black">
            <SearchPage isView={true} onBack={() => setActiveView('stock')} onStockAdded={refresh} />
          </motion.div>
        )}
      </AnimatePresence>

      <ActionMenu isOpen={isActionMenuOpen} onClose={() => setIsActionMenuOpen(false)} activeView={activeView} onViewChange={setActiveView} />

      <MarketDropdown 
        isOpen={isMarketMenuOpen} 
        onClose={() => setIsMarketMenuOpen(false)} 
        selectedMarket={selectedMarket} 
        setSelectedMarket={setSelectedMarket} 
        marketList={marketList} 
        onManageGroups={() => { setIsMarketMenuOpen(false); setTimeout(() => setIsManageGroupsOpen(true), 300); }} 
      />
      <ManageGroupsModal 
        isOpen={isManageGroupsOpen} 
        onClose={() => setIsManageGroupsOpen(false)} 
        groups={groups} 
        selectedMarket={selectedMarket} 
        onAdd={handleAddGroup} 
        onEdit={handleEditGroup} 
        onDelete={handleDeleteGroup} 
        deletingGroupId={deletingGroupId} 
        onReorder={setGroups} 
      />
      {selectedStockDetail && <StockDetailModal isOpen={!!selectedStockDetail} onClose={() => setSelectedStockDetail(null)} stock={selectedStockDetail} onRefresh={refresh} />}
      {selectedStockForGroups && <AddToGroupModal isOpen={!!selectedStockForGroups} onClose={() => setSelectedStockForGroups(null)} stock={selectedStockForGroups} groups={groups} onToggleGroup={handleToggleStockInGroup} />}
    </div>
  );
}