"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import AddMetadataModal from '../../components/Modals/AddMetadataModal';

/**
 * 搜尋視圖 (iOS 原生液態玻璃風格)
 * 修正點：新增成功後觸發 onStockAdded 回調，並自動返回主頁面。
 */
export default function SearchPage({ isView = false, onBack, onStockAdded }) {
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
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  }, [onBack, router]);

  // 3. 搜尋資料庫邏輯
  useEffect(() => {
    const performSearch = async () => {
      if (debouncedQuery.length < 1) {
        setSearchResults([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: searchError } = await supabase
          .from('stock_metadata')
          .select('*')
          .or(`symbol.ilike.%${debouncedQuery}%,name.ilike.%${debouncedQuery}%`)
          .limit(20);

        if (searchError) throw searchError;
        setSearchResults(data || []);
      } catch (err) {
        console.error('搜尋失敗:', err);
        setError('無法取得搜尋結果');
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery]);

  // 4. 🌟 關鍵修正：處理新增股票到觀察清單
  const handleAddExistingStock = async (stock) => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('請先登入');
        return;
      }

      // 檢查是否已在清單中
      const { data: existing } = await supabase
        .from('watchlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('symbol', stock.symbol)
        .single();

      if (existing) {
        alert('此股票已在您的清單中');
        setIsLoading(false);
        return;
      }

      // 執行新增
      const { error: insertError } = await supabase
        .from('watchlist')
        .insert([{
          user_id: user.id,
          symbol: stock.symbol,
          name: stock.name,
          market: stock.market,
          group_name: ['我的代號'], // 預設群組
          sort_order: 999
        }]);

      if (insertError) throw insertError;

      // 成功後的核心動作：
      if (onStockAdded) {
        onStockAdded(); // 👈 通知主頁面刷新數據
      }
      
      // 自動返回主頁面
      setTimeout(() => {
        handleBackToMain();
      }, 100);

    } catch (err) {
      console.error('新增失敗:', err);
      alert('新增失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {/* 頂部搜尋欄 - 固定 */}
      <div className="pt-14 px-4 pb-4 bg-black/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleBackToMain}
            className="text-[#0A84FF] text-[17px] font-medium active:opacity-50 transition-opacity"
          >
            取消
          </button>
          
          <div className="flex-1 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93]">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 stroke-current stroke-[3]">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="搜尋代號或名稱"
              className="w-full bg-[#1C1C1E] border-none rounded-xl py-2 pl-10 pr-4 text-white text-[17px] focus:outline-none placeholder:text-[#8E8E93]"
            />
          </div>
        </div>
      </div>

      {/* 結果列表 - 滾動區 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-4 py-2">
          {isLoading && (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-[#0A84FF] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && searchResults.length === 0 && debouncedQuery && (
            <div className="text-center py-10">
              <p className="text-[#8E8E93] text-[15px]">找不到相關結果</p>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="mt-4 text-[#0A84FF] font-medium"
              >
                手動新增自訂項目
              </button>
            </div>
          )}

          <AnimatePresence>
            {searchResults.map((stock, index) => (
              <motion.div
                key={stock.id || stock.symbol}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center py-4 border-b border-white/5 active:bg-white/5 transition-colors"
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
                  <div className="text-[18px] font-bold text-white tracking-tight truncate">{stock.name}</div>
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
        </div>
      </div>

      {/* 手動新增彈窗 */}
      <AddMetadataModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          if (onStockAdded) onStockAdded();
          handleBackToMain();
        }}
      />
    </div>
  );
}