import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { supabase } from './lib/supabase';

// Hooks
import useStockData from './hooks/useStockData';
import useOutsideClick from './hooks/useOutsideClick';

// Components
import StockItem from './components/StockList/StockItem';
import CustomDialog from './components/Common/CustomDialog';
import DropdownMenu from './components/Common/DropdownMenu';
import AddToListModal from './components/Modals/AddToListModal';
import ManageListModal from './components/Modals/ManageListModal';
import ManualAddModal from './components/Modals/ManualAddModal';

// Icons
const SearchIcon = () => (<svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const MoreIcon = () => (<svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></svg>);
const SortIcon = () => (<svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M7 15L12 20L17 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 9L12 4L17 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const CloseIcon = () => (<svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const AddCircleIcon = () => (<svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 8V16M8 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);

const App = () => {
  // --- UI States ---
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState('我的代號');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  // --- Modal States ---
  const [longPressStock, setLongPressStock] = useState(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isManualAddModalOpen, setIsManualAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dialogConfig, setDialogConfig] = useState({ isOpen: false });

  // --- Data Hook ---
  const { 
    stocks, 
    loading, 
    userLists, 
    setUserLists, 
    fetchStocks, 
    updateSortOrder, 
    toggleStockInList,
    getStockBelongsTo,
    deleteList,
    renameList,
    addList
  } = useStockData(selectedMarket);

  const menuRef = useRef(null);
  const menuTriggerRef = useRef(null);
  const settingsRef = useRef(null);
  const settingsTriggerRef = useRef(null);
  const inputRef = useRef(null);

  // --- Outside Clicks ---
  useOutsideClick(menuRef, () => setIsMenuOpen(false), menuTriggerRef);
  useOutsideClick(settingsRef, () => setIsSettingsOpen(false), settingsTriggerRef);

  // --- Handlers ---
  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('stock_metadata')
        .select('symbol, name_zh, market')
        .or(`symbol.ilike.%${query}%,name_zh.ilike.%${query}%`)
        .limit(10);
      if (error) throw error;
      
      // 確保 symbol 唯一，避免重複 Key 警告
      const uniqueResults = [];
      const seenSymbols = new Set();
      
      data.forEach(item => {
        const key = `${item.symbol}-${item.market}`;
        if (!seenSymbols.has(key)) {
          seenSymbols.add(key);
          uniqueResults.push({
            symbol: item.symbol,
            name: item.name_zh,
            market: item.market,
            current_price: 0,
            change_percent: 0
          });
        }
      });
      
      setSearchResults(uniqueResults);
    } catch (error) {
      console.error('Search error:', error.message);
    }
  };

  const addStockFromSearch = async (stock) => {
    try {
      const { error } = await supabase
        .from('watchlist')
        .upsert({
          symbol: stock.symbol,
          name: stock.name,
          market: stock.market,
          user_id: (await supabase.auth.getUser()).data.user?.id
        }, { on_conflict: 'user_id,symbol' });

      if (error) throw error;
      
      // 存入當前分類
      await toggleStockInList(stock.symbol, selectedMarket);
      
      setIsSearchMode(false);
      setSearchQuery('');
      setSearchResults([]);
      fetchStocks();
    } catch (error) {
      console.error('Error adding stock:', error.message);
    }
  };

  const handleDeleteList = (listId) => {
    const list = userLists.find(l => l.id === listId);
    setDialogConfig({
      isOpen: true,
      type: 'delete',
      title: '刪除觀察列表',
      message: `確定要刪除「${list.name}」嗎？列表內的股票不會被刪除。`,
      onConfirm: () => {
        const needsMarketSwitch = deleteList(listId);
        if (needsMarketSwitch) setSelectedMarket('我的代號');
      }
    });
  };

  const handleRenameList = (listId) => {
    const list = userLists.find(l => l.id === listId);
    setDialogConfig({
      isOpen: true,
      type: 'prompt',
      title: '重新命名列表',
      placeholder: list.name,
      onConfirm: (newName) => {
        if (!newName.trim()) return;
        const oldName = renameList(listId, newName);
        if (selectedMarket === oldName) setSelectedMarket(newName);
      }
    });
  };

  const handleAddList = () => {
    setDialogConfig({
      isOpen: true,
      type: 'prompt',
      title: '新增觀察列表',
      placeholder: '輸入列表名稱',
      onConfirm: (name) => {
        if (!name.trim()) return;
        addList(name);
      }
    });
  };

  const formatMarketText = (text) => text.split('').join(' ');

  return (
    <div className="min-h-screen bg-[#121212] text-white font-sans selection:bg-white/10 selection:text-white pb-20 overflow-x-hidden">
      {/* Header */}
      <header className="px-4 pt-12 pb-4 relative">
        <AnimatePresence mode="wait">
          {!isSearchMode ? (
            <motion.div key="header" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex justify-between items-start">
              <div className="flex flex-col">
                <h1 className="text-[34px] font-bold tracking-tight leading-tight text-white">股市</h1>
                <div className="text-[#8E8E93] text-[15px] font-medium mt-0.5">
                  {new Date().getMonth() + 1}月{new Date().getDate()}日
                </div>
              </div>
              <div className="relative">
                <div className="flex items-center bg-[#2C2C2E] rounded-full px-3 py-1.5 gap-3 mt-1 shadow-sm border border-white/5" ref={settingsTriggerRef}>
                  <button onClick={() => setIsSearchMode(true)} className="text-white hover:opacity-70 transition-opacity"><SearchIcon /></button>
                  <div className="w-[1px] h-4 bg-white/10"></div>
                  <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="text-white hover:opacity-70 transition-opacity"><MoreIcon /></button>
                </div>

                {/* Settings Dropdown */}
                <DropdownMenu
                  isOpen={isSettingsOpen}
                  onClose={() => setIsSettingsOpen(false)}
                  anchorRef={settingsRef}
                  width="200px"
                  className="right-0 left-auto" // 相對於父容器右對齊
                  items={[
                    { 
                      id: 'assets', 
                      label: '資產帳戶', 
                      icon: <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><path d="M20 12V8C20 5.79086 18.2091 4 16 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H16C18.2091 20 20 18.2091 20 16V12ZM20 12H18C17.4477 12 17 11.5523 17 11C17 10.4477 17.4477 10 18 10H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                      onClick: () => console.log('Assets')
                    },
                    { 
                      id: 'settings', 
                      label: '應用設定', 
                      icon: <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                      onClick: () => console.log('Settings')
                    }
                  ]}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div key="search" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="flex items-center gap-3">
              <div className="flex-1 flex items-center bg-[#2C2C2E] rounded-[12px] px-3 py-2.5 gap-2 border border-white/5 shadow-inner">
                <div className="text-[#8E8E93]"><SearchIcon /></div>
                <input autoFocus ref={inputRef} type="text" placeholder="輸入股票代號或名稱" value={searchQuery} onChange={(e) => handleSearch(e.target.value)} className="bg-transparent border-none outline-none text-[17px] w-full placeholder-[#8E8E93] text-white" />
              </div>
              <button onClick={() => { setIsSearchMode(false); setSearchQuery(''); setSearchResults([]); }} className="text-white bg-[#2C2C2E] p-2.5 rounded-full hover:bg-[#3A3A3C] transition-colors"><CloseIcon /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Menu & Sort Trigger */}
        <div className="relative z-[60]">
          <div 
            ref={menuTriggerRef}
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            className="flex items-center gap-1.5 mt-6 px-0.5 text-[#8E8E93] hover:text-white transition-colors cursor-pointer w-fit group"
          >
            <span className="text-[15px] font-medium tracking-wide uppercase">{formatMarketText(selectedMarket)}</span>
            <SortIcon />
          </div>

          <DropdownMenu
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            anchorRef={menuRef}
            items={[
              ...userLists.map((list, idx) => ({
                id: list.id,
                label: list.name,
                onClick: () => setSelectedMarket(list.name),
                className: idx === 2 ? 'border-b border-white/5 mb-1.5 pb-2.5' : '',
                rightElement: selectedMarket === list.name ? <div className="text-[#0A84FF] w-4 h-4"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div> : null
              })),
              {
                id: 'manage',
                label: '管 理 觀 察 列 表',
                icon: <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><path d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                onClick: () => setIsManageModalOpen(true),
                className: 'border-t border-white/5 mt-1'
              }
            ]}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4">
        {loading ? (
          <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white/20"></div></div>
        ) : (
          <div className="flex flex-col">
            <Reorder.Group axis="y" values={stocks} onReorder={updateSortOrder}>
              <AnimatePresence>
                {(isSearchMode ? searchResults : stocks).map((stock) => (
                  <StockItem 
                    key={`${stock.symbol}-${stock.market}`} 
                    stock={stock} 
                    onLongPress={setLongPressStock}
                    isSearchItem={isSearchMode}
                    onAddFromSearch={addStockFromSearch}
                  />
                ))}
              </AnimatePresence>
            </Reorder.Group>

            {/* Search Mode - Bottom Add Button */}
            {isSearchMode && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex justify-center mt-10 mb-20"
              >
                <button 
                  onClick={() => setIsManualAddModalOpen(true)}
                  className="w-12 h-12 bg-[#2C2C2E] rounded-full flex items-center justify-center text-white shadow-lg hover:bg-[#3A3A3C] active:scale-95 transition-all border border-white/5"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </motion.div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <AddToListModal 
        isOpen={!!longPressStock} 
        onClose={() => setLongPressStock(null)} 
        stock={longPressStock} 
        userLists={userLists} 
        getStockBelongsTo={getStockBelongsTo} 
        onToggleStockInList={toggleStockInList} 
      />

      <ManageListModal 
        isOpen={isManageModalOpen} 
        onClose={() => setIsManageModalOpen(false)} 
        userLists={userLists} 
        setUserLists={setUserLists} 
        onDeleteList={handleDeleteList} 
        onRenameList={handleRenameList} 
        onAddList={handleAddList}
      />

      <ManualAddModal 
        isOpen={isManualAddModalOpen} 
        onClose={() => setIsManualAddModalOpen(false)} 
        selectedMarket={selectedMarket} 
        onStockAdded={fetchStocks} 
      />

      <CustomDialog 
        {...dialogConfig} 
        onClose={() => setDialogConfig({ ...dialogConfig, isOpen: false })} 
      />
    </div>
  );
};

export default App;
