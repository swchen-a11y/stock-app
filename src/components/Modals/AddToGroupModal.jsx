"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 加入觀察列表彈窗 (iOS 液態玻璃風格)
 * 修正：統一使用 .ios-glass-capsule 與物理亮邊樣式
 */
const AddToGroupModal = ({ 
  isOpen, 
  onClose, 
  stock, 
  groups, 
  onToggleGroup 
}) => {
  const [localGroupNames, setLocalGroupNames] = useState([]);

  useEffect(() => {
    if (isOpen && stock) {
      // 確保同步時正確處理陣列或預設值
      const current = Array.isArray(stock.group_name) 
        ? stock.group_name 
        : [stock.group_name || '我的代號'];
      setLocalGroupNames(current);
    }
  }, [isOpen, stock]);

  if (!stock) return null;

  const handleItemClick = (groupName) => {
    setLocalGroupNames(prev => 
      prev.includes(groupName)
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    );
    
    // 呼叫父組件傳入的更新邏輯
    onToggleGroup(stock.id, groupName);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 overflow-hidden pointer-events-none">
          {/* 背景遮罩：調整模糊度以突顯彈窗 */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" 
            onClick={onClose} 
          />

          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 450 }}
            /* 修正：套用 ios-glass-capsule 並移除 !bg-[#1c1c1e] 以展示透明感 */
            className="relative w-full max-w-[340px] !rounded-[32px] ios-glass-capsule flex flex-col overflow-hidden pointer-events-auto"
            style={{
              /* 核心修正：手動注入物理亮邊與多重光影，模擬玻璃厚度 */
              boxShadow: `
                0 0 0 0.5px rgba(255, 255, 255, 0.15),
                inset 0 1px 1.5px rgba(255, 255, 255, 0.2),
                inset 0 -0.5px 1px rgba(255, 255, 255, 0.1),
                0 30px 60px rgba(0, 0, 0, 0.5)
              `
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 標題區域 */}
            <div className="w-full flex flex-col items-center pt-8 pb-6 px-6 relative border-b border-white/10">
              <h2 className="text-white text-[19px] font-bold mb-1 text-center tracking-tight">加入觀察列表</h2>
              <p className="text-[#8E8E93] text-[13px] text-center px-4 leading-tight opacity-80">
                選擇 {stock.name} 要顯示於哪個觀察列表。
              </p>
              
              <button 
                onClick={onClose} 
                className="absolute top-6 right-6 w-9 h-9 bg-[#0A84FF] rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-white stroke-[3]">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto ios-scrollbar ios-scrollbar-dark">
              <div className="flex flex-col w-full">
                {groups.map((group) => {
                  const checked = localGroupNames.includes(group.name);
                  return (
                    <button
                      key={group.id}
                      onClick={() => handleItemClick(group.name)}
                      className="w-full flex items-center px-6 py-5 border-b border-white/5 active:bg-white/10 transition-colors text-left"
                    >
                      {/* iOS 勾選框樣式 */}
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mr-4 flex-shrink-0 ${
                        checked ? 'bg-[#0A84FF] border-[#0A84FF]' : 'border-white/20'
                      }`}>
                        {checked && (
                          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white">
                            <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>

                      <span className={`text-[17px] truncate tracking-tight ${checked ? 'text-white font-bold' : 'text-white/90 font-medium'}`}>
                        {group.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-4 w-full" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddToGroupModal;