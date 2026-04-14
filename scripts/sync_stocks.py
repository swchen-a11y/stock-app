import os
import time
import yfinance as yf
import pandas as pd
import numpy as np
import datetime
import pytz
from supabase import create_client
from dotenv import load_dotenv

# --- 1. 初始化環境 ---
def init_supabase():
    current_file = os.path.abspath(__file__)
    root_dir = os.path.dirname(os.path.dirname(current_file))
    env_path = os.path.join(root_dir, '.env.local')
    if os.path.exists(env_path):
        load_dotenv(env_path)

    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        raise ValueError("❌ 缺失 SUPABASE_URL 或 SUPABASE_SERVICE_KEY。")
    
    return create_client(url, key.strip())

supabase = init_supabase()

def clean_val(val, default=0.0):
    if val is None or pd.isna(val): return default
    try:
        v = float(val)
        return v if not (np.isnan(v) or np.isinf(v)) else default
    except: return default

def process_indicators(df):
    """ 計算技術指標：RSI, MA20 距離, 成交量均值 """
    if df.empty or len(df) < 2: return None
    
    # 基本行情
    latest = df.iloc[-1]
    prev = df.iloc[-2]
    
    current_price = clean_val(latest['Close'])
    prev_close = clean_val(prev['Close'])
    change_pct = ((current_price - prev_close) / prev_close * 100) if prev_close != 0 else 0
    
    d = {
        "current_price": current_price,
        "prev_close": prev_close,
        "change_percent": change_pct,
        "open_price": clean_val(latest['Open']),
        "day_high": clean_val(latest['High']),
        "day_low": clean_val(latest['Low']),
        "volume": int(clean_val(latest['Volume'])),
        "trade_date": latest.name.strftime('%Y-%m-%d')
    }

    # 計算 10 日平均成交量 (補全資料庫缺失)
    if len(df) >= 10:
        d["avg_volume_10d"] = int(df['Volume'].tail(10).mean())
    
    # 計算 RSI (14)
    if len(df) >= 15:
        delta = df['Close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        d["rsi_14"] = clean_val(100 - (100 / (1 + rs)).iloc[-1])
    
    # 計算 MA20 乖離率
    if len(df) >= 20:
        ma20 = df['Close'].rolling(window=20).mean().iloc[-1]
        d["ma20_distance"] = ((current_price - ma20) / ma20 * 100) if ma20 != 0 else 0
        
    return d

def sync():
    print(f"🚀 開始同步任務: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 獲取觀察清單中的所有股票
    res = supabase.table("watchlist").select("symbol").execute()
    active_symbols = [r['symbol'] for r in res.data]
    
    if not active_symbols:
        print("ℹ️ 觀察清單為空，跳過同步。")
        return

    # 一次性下載 60 天歷史數據 (用於計算 RSI 與 MA20)
    all_data = yf.download(active_symbols, period="60d", group_by='ticker', threads=True, progress=False)

    for symbol in active_symbols:
        try:
            df = all_data[symbol] if len(active_symbols) > 1 else all_data
            df = df.dropna(subset=['Close'])
            
            payload = process_indicators(df)
            if not payload: continue

            # 抓取基本面 (每小時或每天才更新一次以節省資源，這裡設定為 1/12 機率觸發，約一小時一次)
            if datetime.datetime.now().minute % 60 < 5:
                ticker_obj = yf.Ticker(symbol)
                inf = ticker_obj.info
                payload.update({
                    "market_cap": clean_val(inf.get('marketCap')),
                    "eps": clean_val(inf.get('trailingEps')),
                    "roe": clean_val(inf.get('returnOnEquity', 0)) * 100,
                    "cash_dividend": clean_val(inf.get('dividendRate')),
                    "dividend_yield": clean_val(inf.get('dividendYield', 0)) * 100,
                    "high_52w": clean_val(inf.get('fiftyTwoWeekHigh')),
                    "low_52w": clean_val(inf.get('fiftyTwoWeekLow')),
                    "pe_ratio": clean_val(inf.get('trailingPE')),
                    "pb_ratio": clean_val(inf.get('priceToBook'))
                })

            trade_date = payload.pop("trade_date")

            # 1. 更新 Watchlist (包含技術指標與現價)
            supabase.table("watchlist").update(payload).eq("symbol", symbol).execute()

            # 2. 寫入歷史快取
            history_payload = {
                "symbol": symbol,
                "trade_date": trade_date,
                "close_price": payload["current_price"],
                "volume": payload["volume"],
                "change_percent": payload["change_percent"]
            }
            supabase.table("stock_history").upsert(history_payload, on_conflict="symbol, trade_date").execute()

            print(f"✅ {symbol} 同步完成 (Price: {payload['current_price']})")
            time.sleep(0.5) # 稍微延遲

        except Exception as e:
            print(f"❌ {symbol} 同步出錯: {str(e)}")

if __name__ == "__main__":
    sync()