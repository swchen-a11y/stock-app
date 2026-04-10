import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DropdownMenu = ({ isOpen, onClose, anchorRef, items, width = "220px" }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={onClose} />
          <motion.div
            ref={anchorRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            style={{ width }}
            className="absolute top-full left-0 mt-2 bg-[#2C2C2E]/90 backdrop-blur-xl border border-white/10 rounded-[14px] shadow-2xl z-[90] overflow-hidden"
          >
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => { item.onClick(); onClose(); }}
                className={`w-full flex items-center justify-between px-4 py-3 text-[16px] hover:bg-white/10 active:bg-white/20 transition-colors border-b border-white/5 last:border-none ${item.className || ''}`}
              >
                <div className="flex items-center gap-3">
                  {item.icon && <span className="text-[#8E8E93]">{item.icon}</span>}
                  <span className={item.id === 'manage' ? 'text-[#0A84FF]' : 'text-white'}>
                    {item.label}
                  </span>
                </div>
                {item.rightElement}
              </button>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DropdownMenu;