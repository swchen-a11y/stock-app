import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CustomDialog = ({ isOpen, onClose, title, message, type, onConfirm, placeholder }) => {
  const [inputValue, setInputValue] = React.useState('');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] px-10">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 1.1 }}
            className="bg-[#1C1C1E] w-full max-w-[270px] rounded-[14px] overflow-hidden shadow-2xl relative z-10"
          >
            <div className="p-5 text-center">
              <h3 className="text-white font-bold text-[17px]">{title}</h3>
              {message && <p className="text-white text-[13px] mt-1">{message}</p>}
              {type === 'prompt' && (
                <input 
                  autoFocus
                  className="w-full mt-3 bg-[#2C2C2E] border border-white/10 rounded-md px-2 py-1 text-white text-sm"
                  placeholder={placeholder}
                  onChange={(e) => setInputValue(e.target.value)}
                />
              )}
            </div>
            <div className="flex border-t border-white/10">
              <button onClick={onClose} className="flex-1 py-3 text-[#0A84FF] text-[17px] border-r border-white/10 active:bg-white/5">取消</button>
              <button 
                onClick={() => { onConfirm(inputValue); onClose(); }} 
                className={`flex-1 py-3 text-[17px] font-bold active:bg-white/5 ${type === 'delete' ? 'text-[#FF453A]' : 'text-[#0A84FF]'}`}
              >
                確定
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CustomDialog;