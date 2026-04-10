"use client";

import React from 'react';

/**
 * Search 頁面載入骨架屏
 * 遵循 iOS 原生液態玻璃設計規範
 */
export default function SearchLoading() {
  return (
    <div className="min-h-screen bg-[#121212] text-white px-6 pt-16 pb-10 select-none overflow-x-hidden relative">
      {/* 頂部導航區域骨架 */}
      <div className="flex items-center gap-3 mb-10">
        {/* 搜尋框骨架 */}
        <div className="flex-1 bg-[#1c1c1e] rounded-xl px-3 py-2 flex items-center border border-white/5">
          <div className="w-5 h-5 bg-white/10 rounded-full mr-2 animate-pulse" />
          <div className="flex-1 h-6 bg-white/10 rounded animate-pulse" />
        </div>
        
        {/* 右側 X 按鈕骨架 */}
        <div className="w-10 h-10 bg-[#1c1c1e] rounded-full border border-white/5 animate-pulse" />
      </div>

      {/* 搜尋結果列表骨架 */}
      <div className="flex flex-col space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-full flex items-center py-4 border-b border-white/10">
            {/* 左側加號按鈕骨架 */}
            <div className="w-8 h-8 bg-white/10 rounded-full mr-4 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
            
            {/* 股票資訊骨架 */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div className="h-5 bg-white/10 rounded w-24 animate-pulse" style={{ animationDelay: `${i * 100 + 50}ms` }} />
                <div className="h-4 bg-white/10 rounded w-16 animate-pulse" style={{ animationDelay: `${i * 100 + 100}ms` }} />
              </div>
              <div className="h-4 bg-white/10 rounded w-32 animate-pulse" style={{ animationDelay: `${i * 100 + 150}ms` }} />
            </div>
          </div>
        ))}
      </div>

      {/* 全域載入指示器 */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="ios-glass-capsule !rounded-[28px] p-8 flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
          <p className="text-white text-[17px] font-medium">載入搜尋頁面...</p>
        </div>
      </div>
    </div>
  );
}