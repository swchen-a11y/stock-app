import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase' // 引用你已建立的配置
import GlassCard from './components/GlassCard'

function App() {
  const [stocks, setStocks] = useState([])

  useEffect(() => {
    fetchStocks()
  }, [])

  // 新增錯誤處理
  async function fetchStocks() {
    const { data, error } = await supabase
      .table('watchlist')
      .select('*')
    if (error) {
      console.error('Error fetching stocks:', error)
      return
    }
    if (data) setStocks(data)
  }

  return (
    <div className="min-h-screen p-6 max-w-md mx-auto">
      <h1 className="text-3xl font-bold mb-8 mt-12">我的觀察清單</h1>
      <div className="space-y-4">
        {stocks.map(stock => (
          <GlassCard key={stock.id} className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-apple-gray">{stock.symbol}</span>
              <span className="text-lg font-bold">{stock.name}</span>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold">{stock.current_price || '---'}</div>
              <div className="text-sm text-apple-gray">
                {stock.change_percent ? `${stock.change_percent}%` : '---'}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
      {/* ... 導覽列保持不變 ... */}
    </div>
  )
}