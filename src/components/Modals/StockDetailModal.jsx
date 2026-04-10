"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import EditStockModal from './EditStockModal';

const StockDetailModal = ({ isOpen, onClose, stock, onRefresh }) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState(null);

  if (!stock) return null;

  const formatVolume = (volume, symbol) => {
    if (!volume) return '--';
    const isTW = symbol?.includes('.TW') || symbol?.includes('.TWO');
    const isCN = symbol?.includes('.SS') || symbol?.includes('.SZ');
    const isHK = symbol?.includes('.HK');

    if (isTW) return `${(volume / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} 張`;
    if (isCN) {
      const hands = volume / 100;
      return hands >= 10000 ? `${(hands / 10000).toFixed(2)} 萬手` : `${hands.toFixed(0)} 手`;
    }
    if (isHK) return `${(volume / 10000).toFixed(2)} 萬股`;
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(2)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return `${volume}`;
  };

  const handleAiAnalysis = async () => {
    setIsAiAnalyzing(true);
    setTimeout(() => {
      setAiReport(`【產業】：${stock.category || '通用行業'}\n【策略】：目前 ${stock.name} 量價表現平穩，建議觀察分時走勢。`);
      setIsAiAnalyzing(false);
    }, 1500);
  };

  const changeAmount = stock.change_amount !== undefined ? stock.change_amount : (stock.current_price - stock.prev_close);
  const changeValue = parseFloat(changeAmount);
  
  // 修正顏色邏輯：上漲紅色(#FF453A)，下跌綠色(#30D158)，平盤灰色(#8E8E93)
  let textColor = 'text-[#8E8E93]'; // 預設平盤灰色
  let sign = '';
  
  if (changeValue > 0) {
    textColor = 'text-[#FF453A]'; // 上漲紅色
    sign = '+';
  } else if (changeValue < 0) {
    textColor = 'text-[#30D158]'; // 下跌綠色
    sign = '';
  }

  const horizontalData = [
    { label: '昨收', value: stock.prev_close?.toFixed(2) || '--' },
    { label: '開盤', value: stock.open_price?.toFixed(2) || '--' },
    { label: '成交量', value: formatVolume(stock.volume, stock.symbol) },
    { label: '最高', value: stock.day_high?.toFixed(2) || '--' },
    { label: '最低', value: stock.day_low?.toFixed(2) || '--' },
    { label: '市值', value: stock.market_cap ? (stock.market_cap / 100000000).toFixed(2) + '億' : '--' },
    { label: '52週最高', value: stock.high_52w?.toFixed(2) || '--' },
    { label: '52週最低', value: stock.low_52w?.toFixed(2) || '--' },
    { label: '10日平均量', value: formatVolume(stock.avg_volume_10d, stock.symbol) },
    { label: '殖利率', value: stock.dividend_yield ? `${stock.dividend_yield.toFixed(2)}%` : '--' },
    { label: 'EPS', value: stock.eps?.toFixed(2) || '--' },
    { label: '每股淨值', value: stock.net_value_per_share?.toFixed(2) || '--' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 300 }}
            className="relative w-full h-[92vh] bg-[#1C1C1E] rounded-t-[20px] shadow-2xl border-t border-white/10 overflow-hidden flex flex-col"
          >
            <div className="w-10 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-4 shrink-0" />

            <div className="flex justify-between items-center px-6 mb-6 shrink-0">
              <button onClick={onClose} className="ios-glass-icon active:scale-90 transition-transform">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-white stroke-[2.5]"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>

              <div className="flex items-center bg-white/5 backdrop-blur-xl rounded-full border border-white/10 p-1">
                <button onClick={handleAiAnalysis} className={`w-10 h-8 flex items-center justify-center rounded-l-full active:scale-90 transition-all ${isAiAnalyzing ? 'animate-pulse' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="none" className={`w-5 h-5 ${isAiAnalyzing ? 'stroke-purple-400' : 'stroke-white'} stroke-2`}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                </button>
                <div className="w-[0.5px] h-4 bg-white/20" />
                <button onClick={() => setIsEditOpen(true)} className="w-10 h-8 flex items-center justify-center rounded-r-full active:scale-90 transition-transform">
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-white stroke-2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 space-y-8 scrollbar-hide pb-12">
              <div className="border-b border-white/10 pb-4">
                <div className="flex items-baseline justify-between mb-1">
                  <h2 className="text-[34px] font-bold text-white leading-none">{stock.name}</h2>
                  {/* 修正：同步顯示 category */}
                  <span className="text-[#8E8E93] text-[15px] font-medium">{stock.category || '未分類'}</span>
                </div>
                <div className="text-[#8E8E93] text-[17px] mb-4 uppercase tracking-wide">{stock.symbol}</div>
                <div className="flex items-baseline gap-4">
                  <span className="text-[34px] font-semibold text-white tracking-tight">{stock.current_price?.toFixed(2) || '0.00'}</span>
                  <span className={`text-[20px] font-medium ${textColor}`}>
                    {sign}{changeAmount?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>

              {/* 數據網格 */}
              <div className="overflow-x-auto -mx-6 px-6 scrollbar-hide">
                <div className="flex items-start gap-8 min-w-max pr-6">
                  {[0, 3, 6, 9].map((startIdx, groupIdx) => (
                    <React.Fragment key={groupIdx}>
                      <div className="grid grid-cols-1 gap-y-1">
                        {horizontalData.slice(startIdx, startIdx + 3).map((item, i) => (
                          <div key={i} className="flex justify-between items-center gap-10 py-1.5 border-b border-white/[0.03]">
                            <span className="text-[#8E8E93] text-[13px] font-medium whitespace-nowrap">{item.label}</span>
                            <span className="text-white text-[15px] font-semibold tabular-nums">{item.value}</span>
                          </div>
                        ))}
                      </div>
                      {groupIdx < 3 && <div className="w-[1px] h-16 bg-white/10 self-center" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* AI 分析框 */}
              <div className="ios-glass-capsule rounded-[20px] p-6">
                <div className="text-white text-[15px] leading-relaxed space-y-4 whitespace-pre-wrap">
                  {isAiAnalyzing ? (
                    <div className="flex items-center gap-3 text-[#8E8E93]">
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      正在同步雲端分析數據...
                    </div>
                  ) : (
                    aiReport || <div className="text-[#8E8E93] italic">點擊頂部閃電按鈕，獲取最新的 AI 行情分析報告。</div>
                  )}
                </div>
              </div>
            </div>

            <EditStockModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} stock={stock} onUpdated={onRefresh} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default StockDetailModal;