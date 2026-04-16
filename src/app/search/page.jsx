"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase'; // 這裡從 ../ 改成 ../../
import AddMetadataModal from '../../components/Modals/AddMetadataModal'; // 這裡從 ../ 改成 ../../

/**
 * 搜尋視圖 (iOS 原生液態玻璃風格)
 */
export default function SearchPage({ isView = false, onBack, onStockAdded }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const searchTimeoutRef = useRef(null);

  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 300);
  }, []);

  const handleBack = useCallback(() => {
    onBack ? onBack() : router.back();
  }, [onBack, router]);

  useEffect(() => {
    const performSearch = async () => {
      if (debouncedQuery.length < 1) {
        setSearchResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('stock_metadata')
          .select('*')
          .or(`symbol.ilike.%${debouncedQuery}%,name.ilike.%${debouncedQuery}%`)
          .limit(20);
        if (error) throw error;
        setSearchResults(data || []);
      } catch (err) {
        console.error('搜尋失敗:', err);
      } finally {
        setIsLoading(false);
      }
    };
    performSearch();
  }, [debouncedQuery]);

  const handleAddStock = async (stock) => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert('請先登入');

      const { error } = await supabase.from('watchlist').insert([{
        user_id: user.id,
        symbol: stock.symbol,
        name: stock.name,
        market: stock.market,
        group_name: ['我的代號'],
        sort_order: 999
      }]);

      if (error) throw error;
      if (onStockAdded) onStockAdded();
      handleBack();
    } catch (err) {
      alert('新增失敗或已存在於清單中');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-white">
      <div className="pt-14 px-4 pb-4 bg-black/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="text-[#0A84FF] text-[17px]">取消</button>
          <div className="flex-1 relative">
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="搜尋代號或名稱"
              className="w-full bg-[#1C1C1E] rounded-xl py-2 pl-4 pr-4 text-[17px] focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        {isLoading ? (
          <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0A84FF]"></div></div>
        ) : (
          <AnimatePresence>
            {searchResults.map((stock) => (
              <motion.div
                key={stock.symbol}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center py-4 border-b border-white/5"
              >
                <button 
                  onClick={() => handleAddStock(stock)}
                  className="mr-4 w-8 h-8 bg-[#0A84FF] rounded-full flex items-center justify-center font-bold"
                >
                  +
                </button>
                <div>
                  <div className="text-lg font-bold">{stock.name}</div>
                  <div className="text-sm text-gray-400">{stock.symbol} · {stock.market}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <AddMetadataModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => { if (onStockAdded) onStockAdded(); handleBack(); }}
      />
    </div>
  );
}