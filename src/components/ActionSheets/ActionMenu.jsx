"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 功能切換選單 (iOS 液態玻璃風格)
 * 修正：將打勾圖示移至左側，文字移至右側，保持設計一致性
 */
const ActionMenu = ({ isOpen, onClose, activeView, onViewChange }) => {
  const menuItems = [
    { id: 'stock', label: '股票列表' },
    { id: 'finance', label: '資金帳戶' },
    { id: 'settings', label: '應用設定' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999]">
          {/* 點擊透明背景關閉選單 */}
          <div className="absolute inset-0 bg-transparent" onClick={onClose} />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10, x: 10, originX: 1, originY: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10, x: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 450 }}
            /* 套用 .ios-glass-capsule 並手動注入物理亮邊樣式 */
            className="absolute top-[105px] right-6 w-[200px] ios-glass-capsule !rounded-[24px] !flex-col overflow-hidden shadow-2xl"
            style={{
              /* 強制注入物理亮邊與多重光影，確保邊界清晰 */
              boxShadow: `
                0 0 0 0.5px rgba(255, 255, 255, 0.15),
                inset 0 1px 1.5px rgba(255, 255, 255, 0.25),
                inset 0 -0.5px 1px rgba(255, 255, 255, 0.1),
                0 20px 40px rgba(0, 0, 0, 0.4)
              `
            }}
          >
            <div className="flex flex-col w-full">
              {menuItems.map((item, index) => {
                const isActive = activeView === item.id;
                return (
                  <React.Fragment key={item.id}>
                    <button
                      onClick={() => {
                        onViewChange(item.id);
                        onClose();
                      }}
                      className="flex items-center px-5 py-4 active:bg-white/10 transition-colors w-full"
                    >
                      {/* 💎 核心修正：將打勾圖示移至左側，並預留固定寬度 */}
                      <div className="w-8 flex items-center justify-center shrink-0">
                        {isActive && (
                          <svg viewBox="0 0 24 24" fill="none" className="w-[19px] h-[19px] stroke-white stroke-[3]">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      
                      {/* 💎 核心修正：文字在右側，依據選中狀態調整顏色 */}
                      <span className={`text-[17px] tracking-tight ${isActive ? 'text-white font-bold' : 'text-white/70 font-medium'} flex-1 text-left`}>
                        {item.label}
                      </span>
                    </button>
                    
                    {/* 分隔線顏色對齊 globals.css 的透明度規範 */}
                    {index < menuItems.length - 1 && (
                      <div className="h-[0.5px] bg-white/10 mx-4 shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ActionMenu;