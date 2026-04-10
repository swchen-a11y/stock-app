import React, { useState } from 'react';
import Link from 'next/link';

export default function FinanceView() {
  const [selectedAccount, setSelectedAccount] = useState('TWD'); // 'TWD' or 'CNY'
  const [showPicker, setShowPicker] = useState(false);

  // Mock Data
  const accounts = {
    TWD: { name: '新台幣帳戶', symbol: '$', amount: '1,234,567', pnl: '+1,200', pnlPercent: '0.25%', goal: '2,000,000', progress: 81.7, last: '1,233,367', totalPnl: '+50,000' },
    CNY: { name: '人民幣帳戶', symbol: '¥', amount: '450,000', pnl: '-450', pnlPercent: '0.12%', goal: '1,000,000', progress: 45.0, last: '450,450', totalPnl: '+15,000' }
  };

  const active = accounts[selectedAccount];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Account Picker */}
      <div className="relative mb-6">
        <button 
          onClick={() => setShowPicker(!showPicker)}
          className="flex items-center gap-1.5 text-[#8E8E93] text-[15px] font-medium ios-tap-feedback"
        >
          {active.name}
          {/* 統一的單箭頭，並加上展開時旋轉 180 度的動畫 */}
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            className={`w-4 h-4 stroke-current stroke-[2.5] transition-transform duration-200 ${showPicker ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {showPicker && (
          <div className="absolute top-8 left-0 z-50 w-48 bg-[#1C1C1E] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            {Object.keys(accounts).map((key) => (
              <button 
                key={key}
                className="w-full px-4 py-3 text-left text-[15px] hover:bg-white/5 border-b border-white/5 last:border-0"
                onClick={() => { setSelectedAccount(key); setShowPicker(false); }}
              >
                {accounts[key].name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hero Section */}
      <div className="mb-8">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-[28px] font-bold text-white/50">{active.symbol}</span>
          <h2 className="text-[44px] font-bold tracking-tight leading-tight">{active.amount}</h2>
          <button className="ml-2 opacity-30 hover:opacity-100 transition-opacity">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-white stroke-1.5"><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        <p className={`text-[17px] font-semibold ${active.pnl.startsWith('+') ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
          {active.pnl} ({active.pnlPercent})
        </p>
      </div>

      {/* Goal & Progress */}
      <div className="py-6 border-y border-white/10 mb-6">
        <div className="flex justify-between items-end mb-3">
          <div>
            <p className="text-[#8E8E93] text-[13px] font-medium mb-1">存股目標</p>
            <p className="text-[20px] font-bold">{active.symbol} {active.goal}</p>
          </div>
          <p className="text-[13px] font-bold text-[#8E8E93]">已達成 {active.progress}%</p>
        </div>
        <div className="w-full h-[6px] bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#34C759] transition-all duration-1000" 
            style={{ width: `${active.progress}%` }}
          />
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-y-6">
        <div>
          <p className="text-[#8E8E93] text-[13px] font-medium mb-0.5">昨日結餘</p>
          <p className="text-[17px] font-medium">{active.symbol} {active.last}</p>
        </div>
        <div>
          <p className="text-[#8E8E93] text-[13px] font-medium mb-0.5">累計收益</p>
          <p className="text-[17px] font-medium text-[#34C759]">{active.totalPnl}</p>
        </div>
        <div>
          <p className="text-[#8E8E93] text-[13px] font-medium mb-0.5">剩餘差額</p>
          <p className="text-[17px] font-medium">需補足金額...</p>
        </div>
      </div>
    </div>
  );
}