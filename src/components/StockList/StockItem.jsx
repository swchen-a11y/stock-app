"use client";

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

/**
 * StockItem 組件
 * 修正：徹底解決側滑與點擊詳情衝突，並區分水平滑動（刪除）與垂直拖拽（排序）
 */
const StockItem = ({ 
  stock, 
  onClick, 
  onLongPress, 
  onDelete,
  onDragStart,
  onDragEnd
}) => {
  const [isSwipeToDeleteOpen, setIsSwipeToDeleteOpen] = useState(false);
  // 新增：用來記錄拖拽是否發生的 flag
  const isDragging = useRef(false);
  // 新增：手勢方向追蹤
  const gestureDirection = useRef(null);
  // 新增：拖拽起始位置
  const dragStartPoint = useRef({ x: 0, y: 0 });
  // 新增：手勢閾值設定
  const GESTURE_THRESHOLD = 10; // 像素閾值
  const SWIPE_THRESHOLD = 40; // 側滑刪除閾值

  // 數據格式化
  const price = stock.current_price !== undefined ? stock.current_price.toFixed(2) : "0.00";
  const changePercent = stock.change_percent !== undefined ? stock.change_percent.toFixed(2) : "0.00";
  const changeValue = parseFloat(changePercent);
  
  // 修正顏色邏輯：上漲紅色(#FF453A)，下跌綠色(#30D158)，平盤灰色(#8E8E93)
  let bgColor = 'bg-[#8E8E93]'; // 預設平盤灰色
  let sign = '';
  
  if (changeValue > 0) {
    bgColor = 'bg-[#FF453A]'; // 上漲紅色
    sign = '+';
  } else if (changeValue < 0) {
    bgColor = 'bg-[#30D158]'; // 下跌綠色
    sign = '';
  }

  // 處理拖拽開始
  const handleDragStart = useCallback((event, info) => {
    isDragging.current = false;
    gestureDirection.current = null;
    dragStartPoint.current = { x: info.point.x, y: info.point.y };
    
    // 通知父組件拖拽開始
    if (onDragStart) onDragStart();
  }, [onDragStart]);

  // 處理拖拽過程 - 區分手勢方向
  const handleDrag = useCallback((event, info) => {
    if (!gestureDirection.current) {
      // 計算移動距離
      const deltaX = Math.abs(info.offset.x);
      const deltaY = Math.abs(info.offset.y);
      
      // 判斷手勢方向
      if (deltaX > GESTURE_THRESHOLD && deltaX > deltaY * 1.5) {
        // 水平移動為主 - 側滑刪除
        gestureDirection.current = 'horizontal';
        isDragging.current = true;
      } else if (deltaY > GESTURE_THRESHOLD && deltaY > deltaX * 1.5) {
        // 垂直移動為主 - 排序拖拽
        gestureDirection.current = 'vertical';
        isDragging.current = true;
      }
    }
    
    // 根據手勢方向提供視覺回饋
    if (gestureDirection.current === 'horizontal') {
      // 水平滑動：顯示刪除提示
      const opacity = Math.min(Math.abs(info.offset.x) / 100, 0.3);
      event.target.style.backgroundColor = `rgba(255, 69, 58, ${opacity})`;
    }
  }, []);

  // 處理拖拽結束
  const handleDragEnd = useCallback((event, info) => {
    // 根據手勢方向執行不同操作
    if (gestureDirection.current === 'horizontal') {
      // 水平滑動：檢查是否達到刪除閾值
      if (info.offset.x < -SWIPE_THRESHOLD) {
        setIsSwipeToDeleteOpen(true);
      } else {
        setIsSwipeToDeleteOpen(false);
      }
      
      // 重置背景色
      event.target.style.backgroundColor = '';
    } else if (gestureDirection.current === 'vertical') {
      // 垂直拖拽：排序操作由父組件處理
      setIsSwipeToDeleteOpen(false);
    }
    
    // 延遲重設 flag，確保不會立即觸發 onClick
    setTimeout(() => {
      isDragging.current = false;
      gestureDirection.current = null;
    }, 50);
    
    // 通知父組件拖拽結束
    if (onDragEnd) onDragEnd();
  }, [onDragEnd]);

  return (
    <div className="relative w-full overflow-hidden">
      {/* 底部紅色刪除按鈕 - 寬度固定為 80px */}
      <AnimatePresence>
        {isSwipeToDeleteOpen && (
          <motion.button
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(stock.id);
              setIsSwipeToDeleteOpen(false);
            }}
            className="absolute right-0 top-0 bottom-0 z-10 w-[80px] bg-[#FF453A] flex items-center justify-center"
          >
            <span className="text-white text-[17px] font-bold">刪除</span>
          </motion.button>
        )}
      </AnimatePresence>

      <Reorder.Item
        value={stock}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0, left: -100, right: 0 }}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        dragListener={!isSwipeToDeleteOpen}
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: 1, 
          x: isSwipeToDeleteOpen ? -100 : 0
        }}
        exit={{ opacity: 0 }}
        className="relative z-20 w-full"
        style={{ 
          touchAction: 'pan-y',
          cursor: gestureDirection.current === 'vertical' ? 'grabbing' : 'grab'
        }}
      >
        <div
          className="w-full h-fit py-4 flex justify-between items-center border-b border-white/5 active:bg-white/5 transition-colors px-1"
          style={{ 
            cursor: gestureDirection.current === 'vertical' ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
          onClick={(e) => {
            // 如果剛剛發生過拖拽，或是目前側滑選單是開著的，就攔截點擊
            if (isDragging.current || isSwipeToDeleteOpen) {
              e.preventDefault();
              e.stopPropagation();
              setIsSwipeToDeleteOpen(false); // 收回按鈕
              return;
            }
            // 正常點擊才觸發詳情
            onClick();
          }}
          onTouchStart={(e) => {
            // 記錄觸摸開始時間，用於區分點擊和長按
            e.currentTarget.dataset.touchStart = Date.now();
          }}
          onTouchEnd={(e) => {
            // 檢查是否為長按
            const touchStart = parseInt(e.currentTarget.dataset.touchStart || '0');
            const touchDuration = Date.now() - touchStart;
            
            if (touchDuration > 500 && !isSwipeToDeleteOpen) {
              // 長按觸發分組管理
              e.preventDefault();
              e.stopPropagation();
              onLongPress(stock);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (!isSwipeToDeleteOpen) onLongPress(stock);
          }}
        >
          {/* 左側資訊 */}
          <div className="flex flex-col items-start gap-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[19px] font-bold text-white tracking-tight">{stock.name || '未知股票'}</h3>
              {gestureDirection.current === 'vertical' && (
                <span className="text-[10px] text-[#8E8E93] bg-white/10 px-1.5 py-0.5 rounded">排序中</span>
              )}
              {gestureDirection.current === 'horizontal' && (
                <span className="text-[10px] text-[#FF453A] bg-white/10 px-1.5 py-0.5 rounded">滑動刪除</span>
              )}
            </div>
            <p className="text-[13px] text-[#8E8E93] font-medium tracking-wide uppercase">{stock.symbol}</p>
          </div>

          {/* 右側數據 */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-[17px] font-semibold text-white tabular-nums">{price}</span>
            <div className={`px-2 py-0.5 rounded-[6px] min-w-[65px] flex justify-center ${bgColor}`}>
              <span className="text-white text-[13px] font-bold tabular-nums">
                {sign}{changePercent}%
              </span>
            </div>
          </div>
        </div>
      </Reorder.Item>
    </div>
  );
};

export default StockItem;