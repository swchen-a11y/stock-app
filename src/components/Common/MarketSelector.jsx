"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// 新增 isMenuOpen 參數來判斷旋轉狀態
const MarketSelector = React.memo(({ selectedMarket, onClick, isMenuOpen }) => {
  return (
    <div 
      className="relative z-[100] flex items-center gap-1 mb-6 text-[#8E8E93] cursor-pointer hover:text-white transition-colors w-fit py-2 px-1 -ml-1 ios-tap-feedback"
      onClick={onClick}
    >
      <div className="relative flex items-center gap-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.span 
            key={selectedMarket}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="text-[15px] font-bold tracking-wide uppercase pointer-events-none whitespace-nowrap inline-block"
          >
            {selectedMarket}
          </motion.span>
        </AnimatePresence>
        
        {/* 將 svg 改為 motion.svg */}
        <motion.svg 
          viewBox="0 0 24 24" 
          fill="none" 
          className="w-3.5 h-3.5 stroke-current stroke-[3] pointer-events-none flex-shrink-0"
          // 新增動畫邏輯：根據 isMenuOpen 狀態旋轉 180 度
          animate={{ rotate: isMenuOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          <path 
            d="M6 9l6 6 6-6" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
        </motion.svg>
      </div>
    </div>
  );
});

MarketSelector.displayName = 'MarketSelector';
export default MarketSelector;