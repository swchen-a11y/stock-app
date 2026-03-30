import React from 'react'
import GlassCard from './components/GlassCard'

function App() {
  return (
    <div className="min-h-screen p-6 max-w-md mx-auto">
      <h1 className="text-3xl font-bold mb-8 mt-12 tracking-tight">我的觀察清單</h1>
      
      <div className="space-y-4">
        <GlassCard className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-apple-gray">2330.TW</span>
            <span className="text-lg font-bold">台積電</span>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold">850.00</div>
            <div className="bg-apple-green text-white px-2 py-1 rounded-lg text-sm font-bold mt-1">
              +1.80%
            </div>
          </div>
        </GlassCard>

        <GlassCard className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-apple-gray">600519.SS</span>
            <span className="text-lg font-bold">貴州茅台</span>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold">1,720.00</div>
            <div className="bg-apple-red text-white px-2 py-1 rounded-lg text-sm font-bold mt-1">
              -0.45%
            </div>
          </div>
        </GlassCard>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 h-20 glass-card rounded-none border-t border-white/5 flex items-center justify-around px-10">
        <div className="flex flex-col items-center gap-1 text-apple-blue">
          <span className="text-[20px]">📈</span>
          <span className="text-[10px] font-medium uppercase tracking-wider">自選股</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-apple-gray">
          <span className="text-[20px]">💰</span>
          <span className="text-[10px] font-medium uppercase tracking-wider">資金</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-apple-gray">
          <span className="text-[20px]">⚙️</span>
          <span className="text-[10px] font-medium uppercase tracking-wider">設定</span>
        </div>
      </nav>
    </div>
  )
}

export default App
