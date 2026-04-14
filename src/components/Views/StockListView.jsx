import React from 'react';
import { Reorder, AnimatePresence } from 'framer-motion';
import StockItem from '../Stocks/StockItem';

export default function StockListView({ 
  loading, localStocks, handleReorder, handleDragStart, handleDragEnd, 
  setSelectedStockDetail, setSelectedStockForGroups, handleDeleteStock 
}) {
  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <Reorder.Group axis="y" values={localStocks} onReorder={handleReorder} onDragStart={handleDragStart} onDragEnd={handleDragEnd} className="w-full list-none p-0">
      <AnimatePresence initial={false}>
        {localStocks.map((stock) => (
          <StockItem 
            key={stock.id} 
            stock={stock} 
            onClick={() => setSelectedStockDetail(stock)}
            onLongPress={setSelectedStockForGroups}
            onDelete={handleDeleteStock}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        ))}
      </AnimatePresence>
    </Reorder.Group>
  );
}