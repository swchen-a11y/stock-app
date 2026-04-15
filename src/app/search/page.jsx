"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
// 引入封裝好的服務函數
import { supabase, searchStocks, addToWatchlist } from '../../lib/supabase';
import AddMetadataModal from '../../components/Modals/AddMetadataModal';

/**
 * 搜尋視圖 (iOS 原生液態玻璃風格)
 */
export default function SearchPage({ isView = false, onBack }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const searchTimeoutRef = useRef(null);

  // 1. 處理搜尋輸入與防抖
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 300);
  }, []);

  // 2. 處理返回邏輯
  const handleBackToMain = useCallback(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setIsLoading(false);
    
    if (onBack) {
      onBack(); 
    } else {
      router.replace('/'); 
    }
  }, [router, onBack]);

  // 3. 執行資料庫搜尋 - 改用封裝好的 searchStocks
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery) {
        setSearchResults([]);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        // 使用 supabase.js 中的函數，確保 Schema 設定正確
        const data = await searchStocks(debouncedQuery);
        setSearchResults(data);
      } catch (err) {
        setError(err.message);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery]);

  // 4. 新增現有股票至 watchlist - 改用封裝好的 addToWatchlist
  const handleAddExistingStock = async (stock) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("請先登入");
        return;
      }

      // 使用封裝函數：這會處理「檢查重複」、「計算排序順序」與「插入數據」
      await addToWatchlist(
        user.id, 
        stock.symbol, 
        stock.market, 
        stock.name || stock.name, // 優先使用中文名
        stock.category || '未分類'
      );

      handleBackToMain(); 
    } catch (err) {
      console.error("同步失敗:", err);
      // 如果是因為重複添加，給予提示
      if (err.message.includes('已在觀察列表中')) {
        alert('這支股票已經在您的觀察清單中了');
      } else {
        setError(err.message);
      }
    }
  };

  return (
    <div className="fixed inset-0 h-screen w-screen bg-black text-white z-[2000] flex flex-col overflow-hidden">
      
      {/* 頂部搜尋列 */}
      <div className="w-full pt-16 pb-4 px-6 bg-black/80 backdrop-blur-2xl border-b border-white/5 z-50 flex items-center gap-3 flex-shrink-0">
        <div className="flex-1 bg-white/10 rounded-2xl px-4 py-2.5 flex items-center border border-white/5 group focus-within:bg-white/15 transition-all">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-white/40 stroke-[2.5] mr-3 group-focus-within:stroke-[#0A84FF] transition-colors">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="搜尋代號或名稱"
            className="flex-1 bg-transparent text-white text-[17px] outline-none placeholder:text-white/20"
            autoFocus
          />
        </div>
        
        <button 
          onClick={handleBackToMain}
          className="w-11 h-11 flex items-center justify-center bg-white/5 rounded-full border border-white/10 active:scale-90 transition-all shadow-lg"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-white/80 stroke-[2.5]">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 搜尋結果列表區域 */}
      <div className="flex-1 w-full overflow-y-auto ios-scrollbar px-6 pt-4 pb-24">
        <div className="flex flex-col space-y-1">
          {error ? (
            <div className="p-6 bg-red-500/10 rounded-[24px] border border-red-500/20 text-center">
              <p className="text-red-400 text-[15px] font-medium">{error}</p>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center py-20 opacity-40">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
              <span className="text-[15px]">搜尋中...</span>
            </div>
          ) : searchResults.length === 0 && debouncedQuery ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsAddModalOpen(true)}
                className="w-20 h-20 flex items-center justify-center bg-[#0A84FF] rounded-full shadow-[0_0_30px_rgba(10,132,255,0.4)] mb-6"
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 stroke-white stroke-[3]">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </motion.button>
              <h3 className="text-[19px] font-bold text-white mb-2">找不到此股票</h3>
              <p className="text-[15px] text-white/40">點擊按鈕手動新增至資料庫</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {searchResults.map((stock, i) => (
                <motion.div
                  key={stock.id || stock.symbol}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="w-full flex items-center py-4 border-b border-white/5 active:bg-white/5 transition-colors px-2 rounded-xl"
                >
                  <button 
                    onClick={() => handleAddExistingStock(stock)}
                    className="mr-5 w-8 h-8 flex items-center justify-center bg-[#0A84FF]/10 text-[#0A84FF] rounded-full active:scale-75 transition-all flex-shrink-0"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-current stroke-[3]">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </button>

                  <div className="flex-1 min-w-0">
                    {/* 這裡統一顯示名稱，如果數據庫是 name 請確保對應 */}
                    <div className="text-[18px] font-bold text-white tracking-tight truncate">
                      {stock.name || stock.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[13px] text-[#8E8E93] font-bold tracking-wider uppercase truncate">{stock.symbol}</span>
                      <span className="flex-shrink-0 px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-white/40 font-black uppercase tracking-widest border border-white/10">
                        {stock.market}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      <AddMetadataModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        initialQuery={debouncedQuery}
        onStockAdded={handleBackToMain}
      />
    </div>
  );
}