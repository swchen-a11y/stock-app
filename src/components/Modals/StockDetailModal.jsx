"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';
import { performAiAnalysis } from '../../lib/aiService';
import { supabase } from '../../lib/supabase';
import EditStockModal from './EditStockModal';

const StockDetailModal = ({ isOpen, onClose, stock, onRefresh }) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState(null);
  const [aiScore, setAiScore] = useState(stock?.ai_score || 0);
  const [lastAiGenerated, setLastAiGenerated] = useState(stock?.last_ai_generated_at || null);
  const [userId, setUserId] = useState(null);
  const aiAnalysisRef = useRef(null);
  const reportContainerRef = useRef(null);

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

  // 獲取當前用戶ID
  useEffect(() => {
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
      }
    };
    getUserId();
  }, []);

  // 初始化時檢查快取
  useEffect(() => {
    if (stock?.ai_analysis_report && stock?.last_ai_generated_at) {
      setAiAnalysisResult(stock.ai_analysis_report);
      setAiScore(stock.ai_score || 0);
      setLastAiGenerated(stock.last_ai_generated_at);
    }
  }, [stock]);

  const handleAiAnalysis = async (forceRefresh = false) => {
    if (!userId) {
      console.error('用戶未登入，無法進行AI分析');
      return;
    }

    setIsAiAnalyzing(true);
    
    // 滾動到AI分析區域
    if (aiAnalysisRef.current) {
      setTimeout(() => {
        aiAnalysisRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 300);
    }
    
    try {
      // 調用AI分析服務
      const result = await performAiAnalysis(stock, userId, forceRefresh);
      
      if (result.success) {
        setAiAnalysisResult(result.report);
        setAiScore(result.aiScore);
        setLastAiGenerated(result.lastGenerated);
        
        // 觸發父組件刷新數據
        if (onRefresh && !result.fromCache) {
          setTimeout(() => {
            onRefresh();
          }, 500);
        }
        
        // 如果報告容器存在，滾動到報告頂部
        if (reportContainerRef.current && !result.fromCache) {
          setTimeout(() => {
            reportContainerRef.current.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start' 
            });
          }, 100);
        }
      } else {
        // 處理錯誤情況
        setAiAnalysisResult(result.report || 'AI分析失敗，請稍後再試。');
      }
    } catch (error) {
      console.error('AI分析錯誤:', error);
      setAiAnalysisResult(`【分析錯誤】\n\n抱歉，AI分析過程中發生錯誤：\n\n${error.message}\n\n請檢查網路連接或稍後再試。`);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // 簡單的 Markdown 渲染函數
  const renderMarkdown = (text) => {
    if (!text) return '';
    
    // 分割成行
    const lines = text.split('\n');
    const elements = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // 跳過空行
      if (line.trim() === '') {
        elements.push(<br key={`br-${i}`} />);
        continue;
      }
      
      // 標題檢測 (## 標題 或 【標題】)
      if (line.startsWith('## ') || line.startsWith('【') || line.includes('章節')) {
        elements.push(
          <h4 key={`h-${i}`} className="text-white text-[17px] font-semibold mt-6 mb-3 first:mt-0">
            {line.replace('## ', '').trim()}
          </h4>
        );
        continue;
      }
      
      // 列表項檢測 (- 或 • 或 * 開頭)
      if (line.trim().startsWith('- ') || line.trim().startsWith('• ') || line.trim().startsWith('* ')) {
        elements.push(
          <div key={`li-${i}`} className="flex items-start pl-2 mb-1">
            <span className="text-white/60 mr-2 mt-1.5">•</span>
            <span className="text-white/90 flex-1">{line.trim().substring(2)}</span>
          </div>
        );
        continue;
      }
      
      // 粗體檢測 (**粗體**)
      if (line.includes('**')) {
        const parts = line.split('**');
        const boldElements = [];
        for (let j = 0; j < parts.length; j++) {
          if (j % 2 === 1) {
            // 奇數部分是粗體
            boldElements.push(<strong key={`bold-${j}`} className="text-white font-semibold">{parts[j]}</strong>);
          } else {
            boldElements.push(parts[j]);
          }
        }
        elements.push(
          <p key={`p-${i}`} className="text-white/90 mb-3 leading-relaxed">
            {boldElements}
          </p>
        );
        continue;
      }
      
      // 普通段落
      elements.push(
        <p key={`p-${i}`} className="text-white/90 mb-3 leading-relaxed">
          {line}
        </p>
      );
    }
    
    return elements;
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

  if (!stock) return null;

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
                <motion.button 
                  onClick={() => handleAiAnalysis(true)} 
                  className="w-10 h-8 flex items-center justify-center rounded-l-full relative"
                  whileTap={{ scale: 0.9 }}
                  disabled={isAiAnalyzing}
                >
                  {/* 呼吸燈動畫效果 */}
                  {isAiAnalyzing && (
                    <motion.div 
                      className="absolute inset-0 rounded-l-full bg-purple-400/20"
                      animate={{ 
                        opacity: [0.3, 0.7, 0.3],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{ 
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  )}
                  <Activity className={`w-5 h-5 relative z-10 ${isAiAnalyzing ? 'text-purple-400' : 'text-white/90'}`} strokeWidth={2} />
                </motion.button>
                <div className="w-[0.5px] h-4 bg-white/20" />
                <motion.button 
                  onClick={() => setIsEditOpen(true)} 
                  className="w-10 h-8 flex items-center justify-center rounded-r-full"
                  whileTap={{ scale: 0.9 }}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-white/90 stroke-2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </motion.button>
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
              <div ref={aiAnalysisRef} className="ios-liquid-glass rounded-[20px] p-6 border border-white/10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-purple-400" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="text-white text-[17px] font-semibold">AI 行情分析</h3>
                      {lastAiGenerated && (
                        <p className="text-[#8E8E93] text-[13px]">
                          更新於 {new Date(lastAiGenerated).toLocaleString('zh-TW')}
                          {aiScore > 0 && <span className="ml-2">評分: <span className="text-purple-400 font-medium">{aiScore}/100</span></span>}
                        </p>
                      )}
                    </div>
                  </div>
                  {aiAnalysisResult && !isAiAnalyzing && (
                    <button 
                      onClick={() => handleAiAnalysis(true)}
                      className="text-[#007AFF] text-[14px] font-medium active:scale-95 transition-transform"
                    >
                      重新分析
                    </button>
                  )}
                </div>
                
                <div ref={reportContainerRef} className="text-white text-[15px] leading-relaxed space-y-6">
                  {isAiAnalyzing ? (
                    // iOS 骨架屏
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-[#8E8E93] mb-6">
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span className="text-[15px] font-medium">正在聯網分析中，請稍候...</span>
                      </div>
                      <div className="space-y-3">
                        <div className="h-4 bg-white/10 rounded-full w-3/4 animate-pulse"></div>
                        <div className="h-4 bg-white/10 rounded-full w-full animate-pulse"></div>
                        <div className="h-4 bg-white/10 rounded-full w-5/6 animate-pulse"></div>
                        <div className="h-4 bg-white/10 rounded-full w-full animate-pulse"></div>
                        <div className="h-4 bg-white/10 rounded-full w-4/5 animate-pulse"></div>
                      </div>
                    </div>
                  ) : aiAnalysisResult ? (
                    // Markdown 渲染
                    <div className="prose prose-invert max-w-none">
                      <div className="whitespace-pre-wrap font-sans">
                        {renderMarkdown(aiAnalysisResult)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 rounded-full bg-white/5 mx-auto mb-4 flex items-center justify-center">
                        <Activity className="w-8 h-8 text-white/50" strokeWidth={1.5} />
                      </div>
                      <p className="text-[#8E8E93] text-[15px] font-medium mb-2">尚未進行 AI 分析</p>
                      <p className="text-[#8E8E93] text-[14px] mb-4">點擊頂部折線圖按鈕，獲取即時聯網分析報告</p>
                      <button 
                        onClick={() => handleAiAnalysis(true)}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-white text-[15px] font-medium active:scale-95 transition-transform"
                      >
                        立即分析
                      </button>
                    </div>
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