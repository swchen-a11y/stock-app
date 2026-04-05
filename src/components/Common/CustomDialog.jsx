import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CustomDialog = ({ isOpen, onClose, title, message, onConfirm, type = 'confirm', placeholder = '' }) => {
  const [inputValue, setInputValue] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (type === 'prompt') {
      onConfirm(inputValue);
      setInputValue('');
    } else {
      onConfirm();
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-[270px] bg-[#2C2C2E]/95 backdrop-blur-2xl rounded-[14px] overflow-hidden shadow-2xl flex flex-col items-center pt-5"
        >
          <div className="px-4 pb-4 text-center">
            <h3 className="text-white text-[17px] font-bold">{title}</h3>
            {message && <p className="text-white text-[13px] mt-1">{message}</p>}
            
            {type === 'prompt' && (
              <input
                autoFocus
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={placeholder}
                className="w-full mt-3 bg-black/20 border border-white/10 rounded-md px-2 py-1.5 text-white text-[15px] outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              />
            )}
          </div>

          <div className="w-full flex border-t border-white/10 mt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-[#0A84FF] text-[17px] font-medium border-r border-white/10 active:bg-white/5"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              className={`flex-1 py-3 text-[17px] font-bold active:bg-white/5 ${type === 'delete' ? 'text-[#FF453A]' : 'text-[#0A84FF]'}`}
            >
              確定
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CustomDialog;
