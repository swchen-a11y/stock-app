import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ManageListModal = ({ isOpen, onClose, userLists, onDeleteList, onRenameList, onAddList }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            className="relative w-full h-[80vh] bg-[#1C1C1E] rounded-t-[20px] flex flex-col shadow-2xl"
          >
            <div className="px-6 py-4 flex justify-between items-center border-b border-white/5">
              <button onClick={onAddList} className="text-[#0A84FF] text-[17px]">新增</button>
              <h2 className="text-white font-bold text-[17px]">編輯列表</h2>
              <button onClick={onClose} className="text-[#0A84FF] font-bold text-[17px]">完成</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {userLists.map((list) => (
                <div key={list.id} className="bg-[#2C2C2E] rounded-xl flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => onDeleteList(list.id)}
                      className="bg-[#FF453A] rounded-full p-1 text-white"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M5 12H19" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
                    </button>
                    <span className="text-[17px]">{list.name}</span>
                  </div>
                  <button 
                    onClick={() => onRenameList(list.id)}
                    className="text-[#8E8E93]"
                  >
                    編輯
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ManageListModal;