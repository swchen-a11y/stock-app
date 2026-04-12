"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

/**
 * 編輯持股資訊彈窗
 * 修正：確保執行 onUpdated 以同步顯示最新 category
 */
const EditStockModal = ({ isOpen, onClose, stock, onUpdated }) => {
  const [cost, setCost] = useState('');
  const [shares, setShares] = useState('');
  const [category, setCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && stock) {
      setCost(stock.average_cost || '');
      setShares(stock.current_shares || '');
      setCategory(stock.category || '');
    }
  }, [isOpen, stock]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // 1. 更新個人持股數據
      const { error: watchError } = await supabase
        .from('watchlist')
        .update({
          average_cost: parseFloat(cost) || 0,
          current_shares: parseFloat(shares) || 0,
          // 建議這裡也同步更新一份 category，確保 UI 第一時間能抓到
          category: category 
        })
        .eq('id', stock.id);

      if (watchError) throw watchError;

      // 2. 更新全域 metadata 產業分類
      const { error: metaError } = await supabase
        .from('stock_metadata')
        .update({ category: category })
        .eq('symbol', stock.symbol);

      if (metaError) throw metaError;

      // 3. 核心修正：手動更新目前 stock 物件的 category 屬性
      // 這樣即便父組件還沒 refresh 完成，UI 顯示也會立即改變
      stock.category = category;
      stock.average_cost = parseFloat(cost) || 0;
      stock.current_shares = parseFloat(shares) || 0;

      // 4. 觸發父組件刷新並關閉
      if (onUpdated) {
        await onUpdated(); 
      }
      onClose();
    } catch (err) {
      console.error("同步儲存失敗:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-6 pointer-events-none">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto" 
            onClick={onClose} 
          />
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-[320px] bg-[#1C1C1E] rounded-[28px] p-6 border border-white/10 pointer-events-auto shadow-2xl"
          >
            <h2 className="text-white text-lg font-bold mb-6 text-center tracking-tight">編輯持股資訊</h2>
            
            <div className="space-y-5">
              <div className="relative">
                <label className="text-[#8E8E93] text-[12px] font-medium ml-1 mb-1.5 block">持股成本</label>
                <div className="ios-number-input-container ios-number-input-dark">
                  <input 
                    type="number" 
                    value={cost} 
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#0A84FF] transition-colors tabular-nums ios-number-input" 
                  />
                  <div className="ios-number-input-up-arrow"></div>
                  <div className="ios-number-input-down-arrow"></div>
                </div>
              </div>
              
              <div className="relative">
                <label className="text-[#8E8E93] text-[12px] font-medium ml-1 mb-1.5 block">持股數量</label>
                <div className="ios-number-input-container ios-number-input-dark">
                  <input 
                    type="number" 
                    value={shares} 
                    onChange={(e) => setShares(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#0A84FF] transition-colors tabular-nums ios-number-input" 
                  />
                  <div className="ios-number-input-up-arrow"></div>
                  <div className="ios-number-input-down-arrow"></div>
                </div>
              </div>

              <div className="relative">
                <label className="text-[#8E8E93] text-[12px] font-medium ml-1 mb-1.5 block">產業分類</label>
                <input 
                  type="text" 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="輸入產業類別"
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#0A84FF] transition-colors" 
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={onClose} 
                className="flex-1 py-3.5 rounded-xl bg-white/5 text-white font-bold active:scale-95 transition-transform"
              >
                取消
              </button>
              <button 
                onClick={handleSave} 
                disabled={isLoading}
                className={`flex-1 py-3.5 rounded-xl bg-[#0A84FF] text-white font-bold active:scale-95 transition-transform flex items-center justify-center ${isLoading ? 'opacity-50' : ''}`}
              >
                {isLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "儲存"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default EditStockModal;