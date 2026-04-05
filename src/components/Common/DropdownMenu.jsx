import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DropdownMenu = ({ isOpen, onClose, items, anchorRef, width = '220px', className = '' }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={anchorRef}
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        style={{ width }}
        className={`absolute left-0 top-full mt-2 bg-[#2C2C2E]/90 backdrop-blur-2xl rounded-[14px] shadow-2xl border border-white/10 overflow-hidden z-[100] ${className}`}
      >
        <div className="py-1.5">
          {items.map((item, idx) => (
            <React.Fragment key={item.id || idx}>
              {item.type === 'separator' ? (
                <div className="h-[1px] bg-white/5 my-1 mx-4" />
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onClick?.();
                    if (!item.keepOpen) onClose();
                  }}
                  className={`w-full flex items-center gap-4 px-4 py-2.5 text-white hover:bg-white/10 active:bg-white/20 transition-colors text-left ${item.className || ''}`}
                >
                  {item.icon && (
                    <div className={`w-5 h-5 flex justify-center items-center ${item.iconClassName || ''}`}>
                      {item.icon}
                    </div>
                  )}
                  <span className={`text-[15px] font-medium ${item.textClassName || ''}`}>
                    {item.label}
                  </span>
                  {item.rightElement && (
                    <div className="ml-auto">
                      {item.rightElement}
                    </div>
                  )}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DropdownMenu;
