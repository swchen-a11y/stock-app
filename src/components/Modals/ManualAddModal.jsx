import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

const ManualAddModal = ({ isOpen, onClose, selectedMarket, onStockAdded }) => {
  const [formData, setFormData] = useState({
    symbol: '',
    name: '',
    market: 'CN',
    industry: ''
  });
  const [isMarketMenuOpen, setIsMarketMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const marketMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (marketMenuRef.current && !marketMenuRef.current.contains(e.target)) {
        setIsMarketMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleSymbolChange = (e) => {
    let value = e.target.value.toUpperCase();
    setFormData(prev => ({ ...prev, symbol: value }));
  };

  const formatSymbol = (symbol, market) => {
    if (market === 'TW' && !symbol.endsWith('.TW')) return symbol + '.TW';
    if (market === 'CN') {
      if (symbol.startsWith('6') && !symbol.endsWith('.SS')) return symbol + '.SS';
      if ((symbol.startsWith('0') || symbol.startsWith('3')) && !symbol.endsWith('.SZ')) return symbol + '.SZ';
    }
    return symbol;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const formattedSymbol = formatSymbol(formData.symbol, formData.market);
      const searchKeywords = `${formData.symbol} ${formData.name} ${formData.industry}`.toLowerCase();

      // 1. 寫入 stock_metadata
      const { error: metaError } = await supabase
        .from('stock_metadata')
        .upsert({
          symbol: formattedSymbol,
          name_zh: formData.name,
          market: formData.market,
          industry: formData.industry,
          search_keywords: searchKeywords
        });

      if (metaError) throw metaError;

      // 2. 寫入 watchlist
      const { error: watchError } = await supabase
        .from('watchlist')
        .upsert({
          symbol: formattedSymbol,
          name: formData.name,
          market: formData.market,
          user_id: (await supabase.auth.getUser()).data.user?.id
        });

      if (watchError) throw watchError;

      // 3. 處理分類邏輯
      const categories = JSON.parse(localStorage.getItem('stock_categories') || '{}');
      const currentLists = categories[formattedSymbol] || [];
      if (!currentLists.includes(selectedMarket)) {
        categories[formattedSymbol] = [...currentLists, selectedMarket];
        localStorage.setItem('stock_categories', JSON.stringify(categories));
      }

      onStockAdded();
      onClose();
      setFormData({ symbol: '', name: '', market: 'CN', industry: '' });
    } catch (error) {
      console.error('Error manually adding stock:', error.message);
      alert('新增失敗：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const marketOptions = [
    { value: 'CN', label: '陸股' },
    { value: 'TW', label: '台股' },
    { value: 'US', label: '美股' }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-[340px] bg-[#1C1C1E] rounded-[24px] shadow-2xl border border-white/10 overflow-hidden"
        >
          <div className="p-6">
            <h2 className="text-white text-[20px] font-bold text-center mb-6">手動新增股票</h2>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* 代號 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#8E8E93] ml-1 uppercase font-semibold">代號</label>
                <input
                  required
                  type="text"
                  value={formData.symbol}
                  onChange={handleSymbolChange}
                  placeholder="例如: 600036"
                  className="w-full bg-[#2C2C2E] border border-white/5 rounded-xl px-4 py-3 text-white text-[17px] outline-none focus:border-[#0A84FF]/50 transition-colors"
                />
              </div>

              {/* 名稱 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#8E8E93] ml-1 uppercase font-semibold">名稱</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例如: 招商銀行"
                  className="w-full bg-[#2C2C2E] border border-white/5 rounded-xl px-4 py-3 text-white text-[17px] outline-none focus:border-[#0A84FF]/50 transition-colors"
                />
              </div>

              {/* 市場 - 下拉選單樣式 */}
              <div className="flex flex-col gap-1.5 relative" ref={marketMenuRef}>
                <label className="text-[13px] text-[#8E8E93] ml-1 uppercase font-semibold">市場</label>
                <div 
                  onClick={() => setIsMarketMenuOpen(!isMarketMenuOpen)}
                  className="w-full bg-[#2C2C2E] border border-white/5 rounded-xl px-4 py-3 text-white text-[17px] flex justify-between items-center cursor-pointer hover:bg-[#3A3A3C] transition-colors"
                >
                  <span>{marketOptions.find(o => o.value === formData.market)?.label}</span>
                  <div className={`transition-transform duration-200 ${isMarketMenuOpen ? 'rotate-180' : ''}`}>
                    <ChevronDownIcon />
                  </div>
                </div>

                <AnimatePresence>
                  {isMarketMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="absolute left-0 right-0 top-full mt-2 bg-[#2C2C2E] border border-white/10 rounded-xl shadow-2xl z-[10] overflow-hidden"
                    >
                      {marketOptions.map((option) => (
                        <div
                          key={option.value}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, market: option.value }));
                            setIsMarketMenuOpen(false);
                          }}
                          className="px-4 py-3 text-white text-[16px] hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer border-b border-white/5 last:border-none"
                        >
                          {option.label}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 產業 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#8E8E93] ml-1 uppercase font-semibold">產業</label>
                <input
                  type="text"
                  value={formData.industry}
                  onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                  placeholder="例如: 銀行"
                  className="w-full bg-[#2C2C2E] border border-white/5 rounded-xl px-4 py-3 text-white text-[17px] outline-none focus:border-[#0A84FF]/50 transition-colors"
                />
              </div>

              {/* 操作按鈕 */}
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-[#2C2C2E] text-[#0A84FF] rounded-xl py-3.5 text-[17px] font-bold active:scale-95 transition-all"
                >
                  取消
                </button>
                <button
                  disabled={loading}
                  type="submit"
                  className={`flex-1 bg-[#0A84FF] text-white rounded-xl py-3.5 text-[17px] font-bold active:scale-95 transition-all ${loading ? 'opacity-50' : 'opacity-100'}`}
                >
                  {loading ? '儲存中...' : '確定'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ManualAddModal;
