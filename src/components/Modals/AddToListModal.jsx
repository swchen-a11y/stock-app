import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" preserveAspectRatio="xMidYMid meet">
    <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AddToListModal = ({ isOpen, onClose, stock, userLists, getStockBelongsTo, onToggleStockInList }) => {
  if (!isOpen || !stock) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
        {/* 50% 背景變暗 Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />
        
        {/* 中央彈出視窗 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-[340px] bg-[#1C1C1E] rounded-[24px] shadow-2xl border border-white/10 overflow-hidden flex flex-col items-center p-6"
        >
          {/* 頂部確定按鈕 */}
          <h2 className="text-[20px] font-bold mt-2 text-white">加入觀察列表</h2>
        <p className="text-[#8E8E93] text-[13px] mt-2 text-center px-4">
          選擇 <span className="text-white font-medium">{stock.name}</span> 要顯示於哪個觀察列表。
        </p>

        <div className="w-full mt-8 bg-[#2C2C2E] rounded-[20px] overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar">
          {userLists.map((list) => {
            const belongsTo = getStockBelongsTo(stock.symbol);
            const isChecked = belongsTo.includes(list.name);
            
            return (
              <div
                key={list.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStockInList(stock.symbol, list.name);
                }}
                className="flex items-center px-5 py-4 border-b border-white/5 active:bg-white/10 cursor-pointer transition-colors"
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${isChecked ? 'bg-[#0A84FF] border-[#0A84FF]' : 'border-white/20'}`}>
                  {isChecked && <CheckIcon />}
                </div>
                <span className={`ml-4 text-[17px] font-medium transition-colors ${isChecked ? 'text-[#0A84FF]' : 'text-white'}`}>
                  {list.name}
                </span>
              </div>
            );
          })}
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-6 bg-[#0A84FF] rounded-[18px] py-4 text-[17px] font-bold text-white active:scale-95 transition-all shadow-lg"
        >
          確定加入
        </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AddToListModal;
