import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

const ManualAddModal = ({ isOpen, onClose, onStockAdded }) => {
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');

  const handleAdd = async () => {
    if (!symbol) return;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('watchlist').upsert({
      symbol: symbol.toUpperCase(),
      name: name || symbol.toUpperCase(),
      market: symbol.includes('.') ? symbol.split('.')[1] : 'US',
      user_id: userData.user?.id
    });

    if (!error) {
      onStockAdded();
      onClose();
      setSymbol('');
      setName('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-end">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div 
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            className="relative w-full bg-[#1C1C1E] rounded-t-[20px] p-6 pb-12"
          >
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
            <h2 className="text-xl font-bold mb-4">手動新增代號</h2>
            <div className="space-y-4">
              <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="股票代號 (如 2330.TW)" className="w-full bg-[#2C2C2E] rounded-xl p-4 text-white outline-none focus:ring-2 ring-[#0A84FF]" />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="名稱 (可選)" className="w-full bg-[#2C2C2E] rounded-xl p-4 text-white outline-none focus:ring-2 ring-[#0A84FF]" />
              <button onClick={handleAdd} className="w-full bg-[#0A84FF] text-white font-bold py-4 rounded-xl active:opacity-70 transition-opacity">加入觀察清單</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ManualAddModal;