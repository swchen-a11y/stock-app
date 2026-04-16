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
  
  // 1. 基礎狀態
  const [activeView, setActiveView] = useState('stock'); 
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState('我的代號');
  const [isMarketMenuOpen, setIsMarketMenuOpen] = useState(false);
  const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedStockDetail, setSelectedStockDetail] = useState(null);
  const [selectedStockForGroups, setSelectedStockForGroups] = useState(null);
  const [deletingGroupId, setDeletingGroupId] = useState(null);
  
  // 2. 同步狀態與 Toast
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  // 3. 數據鉤子
  const { 
    stocks, 
    loading, 
    refresh, 
    lastUpdated,
    handleReorder,
    handleDeleteStock,
    handleToggleStockInGroup,
    handleAddGroup,
    handleEditGroup,
    handleDeleteGroup
  } = useStockData(selectedMarket);

  // 4. 自動刷新邏輯 (每 30 秒)
  useEffect(() => {
    const timer = setInterval(() => {
      refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  // 5. 手動觸發 GitHub Action 同步 (透過 API Route 確保安全)
  const handleManualSync = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    showToast('正在發送同步請求...', 'info');

    try {
      const response = await fetch('/api/stock/trigger', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        showToast('同步指令已發送，數據將在幾分鐘內更新', 'success');
        // 同步指令發送後，短暫延遲後刷新本地視圖
        setTimeout(refresh, 2000);
      } else {
        showToast(data.error || '同步請求失敗', 'error');
      }
    } catch (err) {
      showToast('網絡錯誤，請稍後再試', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  // 市場清單與分組邏輯
  const marketList = useMemo(() => {
    return ['我的代號', '台股', '美股', '港股', '陸股', '虛擬幣'];
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#0A84FF]/30">
      <AnimatePresence mode="wait">
        {activeView !== 'search' ? (
          <motion.div 
            key="main-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pb-24"
          >
            {/* Header */}
            <header className="pt-14 px-4 pb-4 sticky top-0 z-[100] bg-black/80 backdrop-blur-xl border-b border-white/5">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-[34px] font-black tracking-tight">
                    {activeView === 'stock' ? '觀察清單' : activeView === 'finance' ? '資金管理' : '設定'}
                  </h1>
                  <p className="text-[13px] text-[#8E8E93] font-medium mt-1">
                    {lastUpdated ? `最後更新：${new Date(lastUpdated).toLocaleTimeString()}` : '連線中...'}
                  </p>
                </div>
                
                <div className="flex items-center gap-4 mb-1">
                  {/* 同步按鈕 */}
                  <button 
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className={`p-2 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all ${isSyncing ? 'animate-spin' : ''}`}
                  >
                    <RefreshCw size={20} className={isSyncing ? 'text-[#0A84FF]' : 'text-white'} />
                  </button>
                  
                  {/* 搜尋按鈕 */}
                  <button 
                    onClick={() => setActiveView('search')}
                    className="p-2 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all"
                  >
                    <Search size={20} />
                  </button>
                  
                  {/* 選單按鈕 */}
                  <button 
                    onClick={() => setIsActionMenuOpen(true)}
                    className="p-2 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all"
                  >
                    <MoreVertical size={20} />
                  </button>
                </div>
              </div>
            </header>

            {/* 主內容區 */}
            <main className="px-4">
              {activeView === 'stock' && (
                <>
                  <MarketSelector 
                    selectedMarket={selectedMarket} 
                    onClick={() => setIsMarketMenuOpen(true)} 
                    isMenuOpen={isMarketMenuOpen} 
                  />
                  <div className="mt-4">
                    <StockListView 
                      loading={loading} 
                      localStocks={stocks} 
                      handleReorder={handleReorder} 
                      setSelectedStockDetail={setSelectedStockDetail} 
                      setSelectedStockForGroups={setSelectedStockForGroups} 
                      handleDeleteStock={handleDeleteStock} 
                    />
                  </div>
                </>
              )}
              {activeView === 'finance' && <FinanceView />}
              {activeView === 'settings' && <SettingsView />}
            </main>
          </motion.div>
        ) : (
          <motion.div 
            key="search-view"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[2000] bg-black"
          >
            <SearchPage 
              isView={true} 
              onBack={() => setActiveView('stock')} 
              onStockAdded={refresh} // 🌟 這裡確保搜尋完後主頁會刷新數據
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast 提示 */}
      <AnimatePresence>
        {toast.show && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[3000] px-4 py-3 rounded-2xl bg-[#1C1C1E] border border-white/10 shadow-2xl flex items-center gap-3 min-w-[280px]"
          >
            {toast.type === 'success' ? <CheckCircle2 className="text-[#32D74B]" size={20} /> : <AlertCircle className="text-[#0A84FF]" size={20} />}
            <span className="text-[15px] font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal 組件 */}
      <ActionMenu 
        isOpen={isActionMenuOpen} 
        onClose={() => setIsActionMenuOpen(false)} 
        activeView={activeView} 
        onViewChange={setActiveView} 
      />

      <MarketDropdown 
        isOpen={isMarketMenuOpen} 
        onClose={() => setIsMarketMenuOpen(false)} 
        selectedMarket={selectedMarket} 
        setSelectedMarket={setSelectedMarket} 
        marketList={marketList} 
        onManageGroups={() => { 
          setIsMarketMenuOpen(false); 
          setTimeout(() => setIsManageGroupsOpen(true), 300); 
        }} 
      />

      <ManageGroupsModal 
        isOpen={isManageGroupsOpen} 
        onClose={() => setIsManageGroupsOpen(false)} 
        groups={groups} 
        onAdd={handleAddGroup} 
        onEdit={handleEditGroup} 
        onDelete={handleDeleteGroup} 
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