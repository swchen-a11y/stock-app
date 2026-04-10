"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

/**
 * 搜尋頁面 (iOS 原生風格)
 * 修正：移除搜尋框內按鈕，由右側 X 按鈕負責返回
 */
export default function SearchPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchTimeoutRef = useRef(null);

  // 1. 處理搜尋輸入與防抖
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 300);
  }, []);

  // 2. 返回主頁功能
  const handleBackToMain = useCallback(() => {
    // 先清除搜尋的 timeout，防止跳轉後仍執行搜尋
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // 停止讀取狀態
    setIsLoading(false);
    
    // 執行跳轉
    router.replace('/'); // 使用 replace 有時比 push 更穩定，能減少歷史堆棧衝突
  }, [router]);

  // 3. 執行資料庫搜尋
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
        const { data, error: supabaseError } = await supabase
          .from('stock_metadata')
          .select('*')
          .or(`symbol.ilike.%${debouncedQuery}%,name.ilike.%${debouncedQuery}%`)
          .limit(15);

        if (supabaseError) throw supabaseError;
        setSearchResults(data || []);
      } catch (err) {
        console.error('搜尋錯誤:', err.message);
        setError(err.message);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery]);

  // 4. 點擊加號：新增至「我的代號」並返回主頁
  const handleAddAndBack = useCallback(async (stock) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('watchlist').upsert({
        symbol: stock.symbol,
        name: stock.name,
        market: stock.market,
        category: stock.category,
        user_id: user.id,
        group_name: ['我的代號']
      }, { onConflict: 'symbol,user_id' });

      if (error) throw error;
      
      router.push('/'); 
    } catch (error) {
      console.error("同步失敗:", error);
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#121212] text-white px-6 pt-16 pb-10 select-none overflow-x-hidden relative">
      {/* 頂部導航區域 */}
      <div className="flex items-center gap-3 mb-10">
        {/* 搜尋框：已移除內部的清除按鈕 */}
        <div className="flex-1 bg-[#1c1c1e] rounded-xl px-3 py-2 flex items-center border border-white/5">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-[#8E8E93] stroke-[2.5] mr-2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="輸入股票代號或名稱"
            className="flex-1 bg-transparent text-white text-[17px] outline-none placeholder:text-[#8E8E93]"
            autoFocus
          />
        </div>
        
        {/* 右側 X 按鈕：負責返回主頁的功能 */}
        <button 
          onClick={handleBackToMain}
          className="w-10 h-10 flex items-center justify-center bg-[#1c1c1e] rounded-full border border-white/5 active:scale-90 transition-transform shadow-lg"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-white stroke-[2.5]">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 搜尋結果列表 */}
      <div className="flex flex-col">
        {error ? (
          <div className="ios-glass-capsule !rounded-[20px] p-6 my-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-red-500 stroke-2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
              </div>
              <div>
                <h3 className="text-white text-[17px] font-bold">搜尋錯誤</h3>
                <p className="text-[#8E8E93] text-[15px]">{error}</p>
              </div>
            </div>
            <button 
              onClick={() => setError(null)}
              className="w-full py-3 bg-white/5 rounded-xl text-white text-[17px] font-medium active:scale-95 transition-transform"
            >
              重試搜尋
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : searchResults.length === 0 && debouncedQuery ? (
          <div className="ios-glass-capsule !rounded-[20px] p-8 my-4 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 stroke-white/50 stroke-2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <h3 className="text-white text-[17px] font-bold mb-2">找不到相關股票</h3>
            <p className="text-[#8E8E93] text-[15px]">請嘗試其他關鍵字或檢查網路連線</p>
          </div>
        ) : (
          <AnimatePresence>
            {searchResults.map((stock, i) => (
              <motion.div
                key={stock.symbol}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="w-full flex items-center py-4 border-b border-white/10"
              >
                {/* 點擊加號：同步並返回 */}
                <button 
                  onClick={() => handleAddAndBack(stock)}
                  className="mr-4 text-white hover:text-[#0A84FF] active:scale-90 transition-all"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 stroke-current stroke-2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v8M8 12h8" />
                  </svg>
                </button>

                <div className="flex-1 flex flex-col items-start">
                  <span className="text-[17px] font-bold text-white tracking-tight">{stock.name}</span>
                  <span className="text-[13px] text-[#8E8E93] font-medium tracking-wide uppercase">{stock.symbol}</span>
                </div>

                <div className="px-2 py-0.5 bg-[#1c1c1e] rounded border border-white/10">
                  <span className="text-[12px] text-[#8E8E93] font-bold uppercase tracking-widest">{stock.market}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}