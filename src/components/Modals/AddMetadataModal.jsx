"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

export default function AddMetadataModal({ isOpen, onClose, initialQuery = '', onStockAdded }) {
  const [formData, setFormData] = useState({
    symbol: '',
    name: '',
    market: 'TW',
    category: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // 判斷陸股後綴的輔助函數
  const detectCNSuffix = (symbolBase) => {
    if (!symbolBase) return '.SS'; // 預設滬市
    const firstChar = symbolBase.charAt(0);
    // 滬市：6, 9 開頭；深市：0, 2, 3 開頭
    return (firstChar === '6' || firstChar === '9') ? '.SS' : '.SZ';
  };

  // 1. 初始化邏輯
  useEffect(() => {
    if (isOpen) {
      const baseQuery = initialQuery.split('.')[0].toUpperCase().replace(/[^0-9A-Z]/g, '');
      setFormData({
        symbol: baseQuery ? `${baseQuery}.TW` : '', 
        name: '',
        market: 'TW',
        category: ''
      });
      setError(null);
    }
  }, [isOpen, initialQuery]);

  // 2. 市場切換邏輯
  const handleMarketChange = (newMarket) => {
    const currentBase = formData.symbol.split('.')[0];
    let suffix = '';

    if (currentBase) {
      switch (newMarket) {
        case 'TW': suffix = '.TW'; break;
        case 'HK': suffix = '.HK'; break;
        case 'CN': suffix = detectCNSuffix(currentBase); break;
        case 'US': suffix = ''; break;
        default: suffix = '';
      }
    }
    
    setFormData({
      ...formData,
      market: newMarket,
      symbol: currentBase ? `${currentBase}${suffix}` : ''
    });
  };

  // 3. 代號輸入邏輯 (即時判斷 CN 後綴)
  const handleSymbolInput = (val) => {
    const upperVal = val.toUpperCase();
    const base = upperVal.split('.')[0];
    
    // 如果目前是陸股，且使用者正在輸入代號，則即時更新後綴
    if (formData.market === 'CN' && base.length > 0) {
      const suffix = detectCNSuffix(base);
      setFormData({ ...formData, symbol: `${base}${suffix}` });
    } else {
      setFormData({ ...formData, symbol: upperVal });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.symbol || !formData.name) {
      setError('請填寫必填欄位（代號與名稱）');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('請先登入帳戶');

      const cleanSymbol = formData.symbol.trim().toUpperCase();
      const cleanName = formData.name.trim();

      // 🌟 同步到 metadata
      const { error: metaError } = await supabase
        .from('stock_metadata')
        .upsert([{
          symbol: cleanSymbol,
          name: cleanName,
          market: formData.market,
          category: formData.category.trim()
        }], { onConflict: 'symbol' });

      if (metaError) throw metaError;

      // 🌟 同步到個人 watchlist
      const { error: watchError } = await supabase
        .from('watchlist')
        .upsert([{
          user_id: user.id,
          symbol: cleanSymbol,
          name: cleanName,
          market: formData.market,
          category: formData.category.trim() || 'Stock',
          group_name: ['我的代號']
        }], { onConflict: 'symbol,user_id' });

      if (watchError) throw watchError;
      
      if (onStockAdded) onStockAdded();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-end">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-full bg-[#1C1C1E] border-t border-white/10 rounded-t-[32px] overflow-hidden shadow-2xl z-10 p-6 pb-12"
          >
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />

            <div className="flex justify-between items-center mb-6 px-2">
              <h3 className="text-xl font-bold">手動新增股票</h3>
              <button onClick={onClose} className="text-[#8E8E93] font-medium">取消</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] text-white/40 ml-1 mb-1 block">市場區域</label>
                  <select 
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-3.5 px-4 outline-none appearance-none text-white"
                    value={formData.market}
                    onChange={e => handleMarketChange(e.target.value)}
                  >
                    <option value="TW">台股 (TW)</option>
                    <option value="US">美股 (US)</option>
                    <option value="CN">陸股 (CN)</option>
                    <option value="HK">港股 (HK)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] text-white/40 ml-1 mb-1 block">股票代號 *</label>
                  <input 
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-3.5 px-4 outline-none focus:border-[#0A84FF] transition-colors"
                    value={formData.symbol}
                    onChange={e => handleSymbolInput(e.target.value)}
                    placeholder="例如: 2330"
                  />
                </div>
              </div>

              <div>
                <label className="text-[13px] text-white/40 ml-1 mb-1 block">股票名稱 *</label>
                <input 
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-3.5 px-4 outline-none focus:border-[#0A84FF] transition-colors"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="例如: 台積電"
                />
              </div>

              <div>
                <label className="text-[13px] text-white/40 ml-1 mb-1 block">產業分類</label>
                <input 
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-3.5 px-4 outline-none focus:border-[#0A84FF] transition-colors"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  placeholder="例如: 半導體"
                />
              </div>

              {error && (
                <p className="text-[#FF453A] text-xs text-center font-medium mt-2">{error}</p>
              )}

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full mt-6 bg-[#0A84FF] text-white py-4 rounded-2xl font-bold text-[17px] active:scale-[0.96] transition-all shadow-lg shadow-[#0A84FF]/20 disabled:opacity-50"
              >
                {isSubmitting ? '同步處理中...' : '確認添加並加入列表'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}