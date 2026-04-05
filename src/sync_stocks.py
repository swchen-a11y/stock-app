import os
import yfinance as yf
import pandas as pd
import numpy as np
import datetime
import pytz
import time
import random
import akshare as ak
import zhconv
from supabase import create_client
from dotenv import load_dotenv

# 1. 初始化環境
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, '.env.local'))

supabase = create_client(os.getenv("VITE_SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

def to_traditional(text):
    if not text: return text
    return zhconv.convert(text, 'zh-tw')

def clean_numeric_data(d):
    """清洗數據，確保符合 JSON 格式且無 NaN"""
    for key, value in d.items():
        if isinstance(value, (float, np.float64, np.float32)):
            if np.isnan(value) or np.isinf(value): d[key] = None
            else: d[key] = float(round(value, 4))
        elif isinstance(value, (int, np.int64)):
            d[key] = int(value)
    return d

def get_active_user_ids(minutes=15):
    threshold = (datetime.datetime.now(pytz.utc) - datetime.timedelta(minutes=minutes)).isoformat()
    try:
        res = supabase.table("profiles").select("id").gt("last_seen", threshold).execute()
        return [user['id'] for user in res.data]
    except: return []

def calculate_indicators(df):
    if len(df) < 20: return df
    df['ma20'] = df['Close'].rolling(window=20).mean()
    std = df['Close'].rolling(window=20).std()
    df['bb_upper'] = df['ma20'] + (std * 2)
    df['bb_lower'] = df['ma20'] - (std * 2)
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss.replace(0, np.nan) 
    df['rsi_14'] = 100 - (100 / (1 + rs))
    return df

def get_stock_data_master(symbol, market):
    """核心：優先使用資料庫中文名稱，抓取詳情數據"""
    print(f"🔍 同步中 {market}: {symbol}...")
    data = {"symbol": symbol, "market": market}
    
    try:
        # --- A. 優先從 stock_metadata 獲取中文名稱 ---
        meta = supabase.table("stock_metadata").select("name_zh").eq("symbol", symbol).execute()
        if meta.data and meta.data[0].get("name_zh"):
            data["name"] = meta.data[0]["name_zh"]
        
        yf_stock = yf.Ticker(symbol)
        hist = yf_stock.history(period="1y") 
        if hist.empty: return None
        
        info = yf_stock.info
        hist = calculate_indicators(hist)
        latest = hist.iloc[-1]
        
        # --- B. 若資料庫無名稱，才使用 yf 抓取並補回 metadata ---
        if "name" not in data:
            raw_name = info.get('shortName') or info.get('longName')
            if raw_name:
                name_zh = to_traditional(raw_name)
                data["name"] = name_zh
                # 同步回填 metadata，下次就不必再抓
                try:
                    supabase.table("stock_metadata").update({"name_zh": name_zh}).eq("symbol", symbol).execute()
                except: pass

        # 1. 價格區域
        cur_price = latest['Close']
        prev_close = info.get('previousClose') or (hist.iloc[-2]['Close'] if len(hist) > 1 else None)
        
        data.update({
            "current_price": cur_price,
            "prev_close": prev_close,
            "open_price": latest['Open'] if not np.isnan(latest['Open']) else info.get('open'),
            "day_high": latest['High'] if not np.isnan(latest['High']) else info.get('dayHigh'),
            "day_low": latest['Low'] if not np.isnan(latest['Low']) else info.get('dayLow'),
        })

        # 2. 交易與市值
        data.update({
            "volume": int(latest['Volume']) if not np.isnan(latest['Volume']) else info.get('volume', 0),
            "avg_volume_10d": info.get('averageVolume10days') or info.get('averageVolume'),
            "market_cap": info.get('marketCap'),
            "high_52w": hist['High'].max(),
            "low_52w": hist['Low'].min(),
        })

        # 3. 財務指標
        data.update({
            "eps": info.get('trailingEps'),
            "net_value_per_share": info.get('bookValue'),
            "pe_ratio": info.get('trailingPE'),
            "pb_ratio": info.get('priceToBook'),
            "roe": (info.get('returnOnEquity', 0) * 100) if info.get('returnOnEquity') else None,
            "cash_dividend": info.get('dividendRate') or info.get('trailingAnnualDividendRate'),
        })

        # 4. 技術指標
        data.update({
            "ma20_distance": ((cur_price - latest['ma20']) / latest['ma20'] * 100) if not pd.isna(latest['ma20']) else 0,
            "rsi_14": latest['rsi_14'] if not pd.isna(latest['rsi_14']) else None,
            "bb_upper": latest['bb_upper'] if not pd.isna(latest['bb_upper']) else None,
            "bb_lower": latest['bb_lower'] if not pd.isna(latest['bb_lower']) else None,
        })

        if data.get("rsi_14"):
            if data["rsi_14"] > 70: data["trend_signal"] = "看空(超買)"
            elif data["rsi_14"] < 30: data["trend_signal"] = "看多(超跌)"
            else: data["trend_signal"] = "趨勢中性"

    except Exception as e:
        print(f"❌ {symbol} 失敗: {e}")
        return None

    return clean_numeric_data(data)

def sync_watchlist():
    active_ids = get_active_user_ids()
    if not active_ids: return

    items = supabase.table("watchlist").select("user_id, symbol, market").in_("user_id", active_ids).execute().data
    if not items: return

    stock_cache = {}
    unique_stocks = list(set((item['symbol'], item['market']) for item in items))

    for symbol, market in unique_stocks:
        master_data = get_stock_data_master(symbol, market)
        if master_data:
            stock_cache[symbol] = master_data
            try:
                supabase.table("stock_history").upsert({
                    "symbol": symbol, "trade_date": datetime.date.today().isoformat(),
                    "close_price": master_data["current_price"], "volume": master_data["volume"]
                }, on_conflict="symbol,trade_date").execute()
            except: pass
        time.sleep(random.uniform(1, 2))

    for item in items:
        symbol, user_id = item['symbol'], item['user_id']
        if symbol in stock_cache:
            payload = stock_cache[symbol].copy()
            payload["user_id"] = user_id
            supabase.table("watchlist").upsert(payload, on_conflict="user_id,symbol").execute()

if __name__ == "__main__":
    sync_watchlist()