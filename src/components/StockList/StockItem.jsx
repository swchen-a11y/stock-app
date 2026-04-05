import React from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import useLongPress from '../../hooks/useLongPress';

const StockItem = ({ stock, onLongPress, isSearchItem, onAddFromSearch }) => {
  const longPressProps = useLongPress(() => !isSearchItem && onLongPress(stock));
  const dragControls = useDragControls();

  const formatPrice = (price) => {
    return typeof price === 'number' && price > 0 ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
  };

  const formatPercent = (percent) => {
    if (typeof percent !== 'number' || percent === 0) return '--%';
    const prefix = percent >= 0 ? '+' : '';
    return `${prefix}${percent.toFixed(2)}%`;
  };

  return (
    <Reorder.Item
      value={stock}
      dragListener={!isSearchItem}
      dragControls={dragControls}
      {...longPressProps}
      className="flex justify-between items-center py-4 border-b border-white/5 active:bg-white/5 transition-colors cursor-pointer select-none touch-pan-y"
    >
      <div className="flex items-center gap-3 flex-1">
        {isSearchItem && (
          <button 
            onClick={(e) => { e.stopPropagation(); onAddFromSearch(stock); }}
            className="text-white hover:text-white/70 transition-colors p-1"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 8V16M8 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
        <div className="flex flex-col">
          <span className="text-[17px] font-bold leading-tight text-white">
            {stock.name || stock.symbol}
          </span>
          <span className="text-[13px] text-[#8E8E93] font-medium mt-0.5 uppercase tracking-wide">
            {stock.symbol}
          </span>
        </div>
      </div>

      {!isSearchItem && (
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[17px] font-semibold leading-tight text-white">
              {formatPrice(stock.current_price)}
            </div>
          </div>
          
          <div 
            className={`min-w-[84px] py-1.5 px-2 rounded-[8px] flex justify-center items-center text-white font-bold text-[15px] transition-colors ${
              stock.change_percent >= 0 ? 'bg-[#FF3B30]' : 'bg-[#34C759]'
            }`}
          >
            {formatPercent(stock.change_percent)}
          </div>
        </div>
      )}
    </Reorder.Item>
  );
};

export default StockItem;
