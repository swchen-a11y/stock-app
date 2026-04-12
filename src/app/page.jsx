"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import SearchPage from './search/page'; 

export default function StockApp() {
  // 視圖切換狀態：'stock' | 'finance' | 'search' | 'settings'
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
  
  const isDraggingRef = useRef(false);
  const pendingStocksRef = useRef(null);

  const { stocks: fetchedStocks, loading, refresh } = useStockData(selectedMarket);

  // 同步資料庫資料到本地狀態
  useEffect(() => {
    if (fetchedStocks && !isDraggingRef.current) {
      const sorted = [...fetchedStocks].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      setLocalStocks(sorted);
    } else if (fetchedStocks && isDraggingRef.current) {
      pendingStocksRef.current = fetchedStocks;
    }
  }, [fetchedStocks]);

  // 初始化登入與獲取分組
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await supabase.auth.signInWithPassword({
          email: 'vongola0504@gmail.com',
          password: '0504swchen'
        });
      }
      fetchGroups();
    };
    init();
  }, []);

  const fetchGroups = async () => {
    const { data } = await supabase.from('user_groups').select('*').order('created_at', { ascending: true });
    if (data && data.length > 0) setGroups(data);
    else setGroups([{ id: 'default', name: '我的代號' }]);
  };

  const handleAddGroup = async (groupName) => {
    if (!groupName || groupName.trim() === '') throw new Error('請輸入分組名稱');
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('user_groups').insert([{ user_id: user.id, name: groupName.trim() }]);
    await fetchGroups();
  };

  const handleEditGroup = async (groupId, newName) => {
    await supabase.from('user_groups').update({ name: newName.trim() }).eq('id', groupId);
    await fetchGroups();
    if (selectedMarket === groups.find(g => g.id === groupId)?.name) setSelectedMarket(newName.trim());
  };

  const handleDeleteGroup = async (groupId) => {
    setDeletingGroupId(groupId);
    await supabase.from('user_groups').delete().eq('id', groupId);
    await fetchGroups();
    if (selectedMarket === groups.find(g => g.id === groupId)?.name) setSelectedMarket('我的代號');
    setDeletingGroupId(null);
  };

  const handleReorder = async (newOrder) => {
    isDraggingRef.current = true;
    setLocalStocks(newOrder);
    const updates = newOrder.map((stock, index) => ({ id: stock.id, sort_order: index }));
    await supabase.from('watchlist').upsert(updates);
    isDraggingRef.current = false;
  };

  const handleDragStart = useCallback(() => { isDraggingRef.current = true; }, []);
  const handleDragEnd = useCallback(() => { 
    isDraggingRef.current = false;
    if (pendingStocksRef.current) {
      setLocalStocks(pendingStocksRef.current);
      pendingStocksRef.current = null;
    }
  }, []);

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
    setTimeout(() => refresh(), 300);
  };

  const marketList = useMemo(() => groups.map(g => g.name), [groups]);

  return (
    <div className="min-h-screen bg-[#121212] text-white select-none overflow-hidden relative font-pingfang">
      
      <AnimatePresence mode="wait">
        {activeView !== 'search' ? (
          /* 🌟 股市與資金視圖：帶有內邊距與正常 Header */
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
                  {activeView === 'stock' ? '股市' : '資金'}
                </h1>
                <p className="text-[#8E8E93] text-[15px] font-medium">
                  {new Date().getMonth() + 1}月{new Date().getDate()}日
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="ios-glass-capsule !rounded-full px-3 py-1.5 flex items-center gap-3">
                  <button 
                    onClick={() => setActiveView('search')} 
                    className="ios-tap-feedback opacity-80"
                  >
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
                <MarketSelector 
                  selectedMarket={selectedMarket} 
                  onClick={() => setIsMarketMenuOpen(true)} 
                  isMenuOpen={isMarketMenuOpen} 
                />
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
            
            {activeView === 'finance' && (
              <main className="mt-4">
                <FinanceView />
              </main>
            )}
          </motion.div>
        ) : (
          /* 🌟 搜尋視圖：絕對定位佔滿全螢幕，無視外層 px-4 */
          <motion.div 
            key="search-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[2000] bg-black"
          >
            <SearchPage 
              isView={true} 
              onBack={() => setActiveView('stock')} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ActionMenu 
        isOpen={isActionMenuOpen} 
        onClose={() => setIsActionMenuOpen(false)} 
        activeView={activeView} 
        onViewChange={setActiveView} 
      />

      {/* Modal 組件 */}
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
        selectedMarket={selectedMarket} 
        onAdd={handleAddGroup} 
        onEdit={handleEditGroup} 
        onDelete={handleDeleteGroup} 
        deletingGroupId={deletingGroupId} 
        onReorder={setGroups} 
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