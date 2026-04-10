import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AssignToGroupActionSheet = ({ 
  isOpen, 
  onClose, 
  stock,
  groups = [],
  selectedGroupIds = [],
  onToggleGroup
}) => {
  const handleGroupToggle = (groupId) => {
    if (onToggleGroup) {
      onToggleGroup(stock?.id, groupId);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-fit min-w-[280px] bg-[#1C1C1E] rounded-[20px] flex flex-col shadow-2xl max-h-[70vh]"
          >
            {/* 標題區域 */}
            <div className="px-6 py-4 border-b border-white/5">
              <h2 className="text-white font-bold text-[17px] text-center">
                加入觀察列表
              </h2>
              {stock && (
                <p className="text-[#8E8E93] text-[13px] text-center mt-1">
                  {stock.name} ({stock.symbol})
                </p>
              )}
            </div>

            {/* 分組列表 */}
            <div className="flex-1 overflow-y-auto p-4">
              {groups.length > 0 ? (
                <div className="space-y-2">
                  {groups.map((group) => {
                    const isSelected = selectedGroupIds.includes(group.id);
                    return (
                      <button
                        key={group.id}
                        onClick={() => handleGroupToggle(group.id)}
                        className="w-full bg-[#2C2C2E] rounded-xl p-4 flex items-center justify-between hover:bg-[#3A3A3C] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {/* 勾選圖示 */}
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-[#0A84FF] bg-[#0A84FF]' : 'border-[#8E8E93]'}`}>
                            {isSelected && (
                              <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 text-white">
                                <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                              </svg>
                            )}
                          </div>
                          
                          {/* 分組資訊 */}
                          <div className="text-left">
                            <div className="text-white text-[17px]">{group.name}</div>
                            <div className="text-[#8E8E93] text-[13px]">
                              {group.stockCount || 0} 支股票
                            </div>
                          </div>
                        </div>

                        {/* 如果已選中，顯示勾選圖示 */}
                        {isSelected && (
                          <div className="text-[#0A84FF]">
                            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-[#2C2C2E] rounded-full flex items-center justify-center mb-4">
                    <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-[#8E8E93]">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <p className="text-[#8E8E93] text-[15px] mb-2">尚未建立任何觀察列表</p>
                  <p className="text-[#8E8E93] text-[13px]">請先建立觀察列表</p>
                </div>
              )}
            </div>

            {/* 取消按鈕 */}
            <div className="p-4 border-t border-white/5">
              <button
                onClick={onClose}
                className="w-full bg-[#2C2C2E] rounded-xl py-4 text-white text-[17px] font-bold hover:bg-[#3A3A3C] transition-colors"
              >
                取消
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AssignToGroupActionSheet;