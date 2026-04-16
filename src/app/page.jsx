"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle2, AlertCircle, Search, MoreVertical } from 'lucide-react';
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

  // 取得資料庫數據與刷新函數
  const { stocks: fetchedStocks, loading, refresh } = useStockData(selectedMarket);

  // --- 自動刷新機制 (每 30 秒) ---
  useEffect(() => {
    const autoRefreshInterval = setInterval(() => {
      // 僅在股票視圖、非加載中、非手動同步中、非拖拽時刷新
      if (activeView === 'stock' && !isDraggingRef.current && !loading && !isSyncing) {
        refresh();
      }
    }, 30000);

    return () => clearInterval(autoRefreshInterval);
  }, [activeView, loading, refresh, isSyncing]);

  // --- Toast 自動消失 ---
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  // 監控數據變化並更新本地狀態
  useEffect(() => {
    if (fetchedStocks && !isDraggingRef.current) {
      const sorted = [...fetchedStocks].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      setLocalStocks(sorted);
    } else if (fetchedStocks && isDraggingRef.current) {
      pendingStocksRef.current = fetchedStocks;
    }
  }, [fetchedStocks]);

  // --- 手動觸發 GitHub Action 同步 ---
  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 延長至 12 秒

      const response = await fetch('/api/stock/trigger', { 
        method: 'POST',
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({ success: false, error: '解析失敗' }));
      
      if (data.success) {
        setToast({ show: true, message: '同步已開始，預計 1 分鐘內更新', type: 'success' });
      } else {
        setToast({ show: true, message: '觸發失敗: ' + (data.error || '未知錯誤'), type: 'error' });
      }
    } catch (error) {
      const msg = error.name === 'AbortError' ? '連線超時，請檢查網絡' : '同步觸發失敗';
      setToast({ show: true, message: msg, type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  // --- 獲取分組資料 ---
  const fetchGroups = useCallback(async () => {
    const { data } = await supabase.from('user_groups').select('*').order('created_at', { ascending: true });
    if (data && data.length > 0) {
      setGroups(data);
    } else {
      setGroups([{ id: 'default', name: '我的代號' }]);
    }
  }, []);

  // 初始化檢查
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

  // --- 拖拽排序邏輯 ---
  const handleReorder = useCallback(async (newOrder) => {
    setLocalStocks(newOrder);
    const updates = newOrder.map((stock, index) => ({ id: stock.id, sort_order: index }));
    await supabase.from('watchlist').upsert(updates);
  }, []);

  const handleDragStart = useCallback(() => { isDraggingRef.current = true; }, []);
  const handleDragEnd = useCallback(() => { 
    isDraggingRef.current = false;
    if (pendingStocksRef.current) {
      setLocalStocks(pendingStocksRef.current);
      pendingStocksRef.current = null;
    }
  }, []);

  // --- 分組與刪除邏輯 ---
  const handleAddGroup = async (name) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('user_groups').insert([{ user_id: user.id, name: name.trim() }]);
    fetchGroups();
  };

  const handleEditGroup = async (id, name) => {
    await supabase.from('user_groups').update({ name: name.trim() }).eq('id', id);
    fetchGroups();
  };

  const handleDeleteGroup = async (id) => {
    setDeletingGroupId(id);
    await supabase.from('user_groups').delete().eq('id', id);
    fetchGroups();
    setDeletingGroupId(null);
  };

  const handleToggleStockInGroup = async (stockId, groupName) => {
    const target = localStocks.find(s => s.id === stockId);
    let currentGroups = Array.isArray(target.group_name) ? target.group_name : [target.group_name || '我的代號'];
    let newGroups = currentGroups.includes(groupName) ? currentGroups.filter(g => g !== groupName) : [...currentGroups, groupName];
    await supabase.from('watchlist').update({ group_name: newGroups }).eq('id', stockId);
    refresh();
  };

  const handleDeleteStock = async (stockId) => {
    setLocalStocks(prev => prev.filter(s => s.id !== stockId));
    await supabase.from('watchlist').delete().eq('id', stockId);
    setTimeout(() => refresh(), 500);
  };

  const marketList = useMemo(() => groups.map(g => g.name), [groups]);

  return (
    <div className="min-h-screen bg-[#121212] text-white select-none overflow-hidden relative font-pingfang">
      
      {/* 🌟 全域 Toast 提示 */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 z-[5000] px-4"
          >
            <div className={`px-5 py-3 rounded-2xl backdrop-blur-xl border flex items-center gap-3 shadow-2xl ${
              toast.type === 'success' ? 'bg-white/10 border-white/20' : 'bg-red-500/20 border-red-500/30'
            }`}>
              {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
              <span className="text-[14px] font-medium">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {activeView !== 'search' ? (
          <motion.div 
            key="main"
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
                  {new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}
                </p>
              </div>
              
              <div className="flex items-center gap-2 mt-2">
                <div className="ios-glass-capsule !rounded-full px-3 py-1.5 flex items-center gap-3">
                  {/* 同步按鈕 */}
                  <button 
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className={`ios-tap-feedback transition-all ${isSyncing ? 'opacity-30' : 'opacity-80'}`}
                  >
                    <RefreshCw className={`w-5 h-5 stroke-[2.5] ${isSyncing ? 'animate-spin' : ''}`} />
                  </button>

                  <div className="w-[1px] h-4 bg-white/10" />

                  {/* 搜尋按鈕 */}
                  <button onClick={() => setActiveView('search')} className="ios-tap-feedback opacity-80">
                    <Search className="w-5 h-5 stroke-[2.5]" />
                  </button>

                  <div className="w-[1px] h-4 bg-white/10" />

                  {/* 更多菜單 */}
                  <button className="ios-tap-feedback opacity-80" onClick={() => setIsActionMenuOpen(true)}>
                    <MoreVertical className="w-5 h-5" />
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
          /* 🌟 搜尋頁面組件：傳入 refresh 以實現新增後即時更新 */
          <motion.div key="search" className="fixed inset-0 z-[2000] bg-black">
            <SearchPage 
              isView={true} 
              onBack={() => setActiveView('stock')} 
              onStockAdded={() => {
                refresh(); // 👈 關鍵：通知主頁面更新數據
              }} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 彈窗組件 */}
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
        onAdd={handleAddGroup} 
        onEdit={handleEditGroup} 
        onDelete={handleDeleteGroup} 
        deletingGroupId={deletingGroupId} 
      />

      {selectedStockDetail && (
        <StockDetailModal 
          isOpen={!!selectedStockDetail} 
          onClose={() => setSelectedStockDetail(null)} 
          stock={selectedStockDetail} 
          onRefresh={refresh} 
        />
      )}
      
      {selectedStockForGroups && (
        <AddToGroupModal 
          isOpen={!!selectedStockForGroups} 
          onClose={() => setSelectedStockForGroups(null)} 
          stock={selectedStockForGroups} 
          groups={groups} 
          onToggleGroup={handleToggleStockInGroup} 
        />
      )}
    </div>
  );
}