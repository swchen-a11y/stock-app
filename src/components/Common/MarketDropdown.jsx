"use client";

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MarketDropdown = ({ 
  isOpen, 
  onClose, 
  selectedMarket, 
  setSelectedMarket, 
  marketList = ['我的代號'],
  onManageGroups 
}) => {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-start justify-start p-5">
          {/* 遮罩：輕微變暗以突出玻璃主體 */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute  inset-0 bg-black/20"
            onClick={onClose}
          />
          
          {/* 選單主體：套用強化的 ios-dropdown-base */}
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: "spring", damping: 25, stiffness: 450 }}
            className="relative top-[150px] w-[230px] ios-dropdown-base py-2.5"
            onClick={(e) => e.stopPropagation()} 
          >
            <div className="flex flex-col w-full">
              {marketList.map((market, index) => (
                <button
                  key={`${market}-${index}`}
                  onClick={() => {
                    setSelectedMarket(market);
                    onClose();
                  }}
                  className="w-full flex items-center px-5 py-3.5 transition-all active:bg-white/10 text-left ios-tap-feedback"
                >
                  <div className="w-8 flex-shrink-0">
                    {selectedMarket === market && (
                      <motion.svg 
                        layoutId="check-icon"
                        viewBox="0 0 24 24" 
                        fill="none" 
                        className="w-5 h-5 text-white"
                      >
                        <path 
                          d="M20 6L9 17L4 12" 
                          stroke="currentColor" 
                          strokeWidth="2.5" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </motion.svg>
                    )}
                  </div>
                  
                  <span className={`text-[19px] tracking-tight ${selectedMarket === market ? 'text-white font-semibold' : 'text-white/80'}`}>
                    {market}
                  </span>
                </button>
              ))}
              
              <div className="mx-5 h-[0.5px] bg-white/10 my-1" />

              {onManageGroups && (
                <button
                  onClick={() => {
                    onClose();
                    setTimeout(() => onManageGroups(), 100);
                  }}
                  className="w-full flex items-center px-5 py-3.5 active:bg-white/10 ios-tap-feedback"
                >
                  <div className="w-8 flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white/60">
                      <path d="M8 8h10M8 12h10M8 16h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="5" cy="8" r="1.2" fill="currentColor"/>
                      <circle cx="5" cy="12" r="1.2" fill="currentColor"/>
                      <circle cx="5" cy="16" r="1.2" fill="currentColor"/>
                    </svg>
                  </div>
                  <span className="text-[19px] tracking-tight text-white/80">管理觀察列表</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default MarketDropdown;