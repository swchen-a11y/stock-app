import os
import yfinance as yf
import pandas as pd
import akshare as ak
import zhconv
import numpy as np
import datetime
import pytz
import time
import random
from FinMind.data import DataLoader
from supabase import create_client
from dotenv import load_dotenv

# 1. 初始化環境
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, '.env.local'))

# 初始化 Supabase 用戶端 (使用 Service Role Key 以確保更新權限)
supabase = create_client(os.getenv("VITE_SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

# --- 工具函數 ---

def to_traditional(text):
    """簡轉繁工具"""
    if not text: return text
    return zhconv.convert(text, 'zh-tw')

def clean_numeric_data(d):
    """清洗數據，將 NaN/Inf 轉為 None 避免 JSON 錯誤"""
    for key, value in d.items():
        if isinstance(value, float):
            if np.isnan(value) or np.isinf(value): d[key] = None
    return d

def is_market_open(market):
    """判斷各市場是否處於交易時段 (週一至週五)"""
    now_utc = datetime.datetime.now(pytz.utc)
    
    if market == "TW" or market == "CN":
        tz = pytz.timezone('Asia/Taipei')
        local_time = now_utc.astimezone(tz)
        if local_time.weekday() < 5:
            start = datetime.time(9, 0)
            end = datetime.time(15, 30) # 包含盤後結算時間
            return start <= local_time.time() <= end
            
    elif market == "US":
        tz = pytz.timezone('America/New_York')
        local_time = now_utc.astimezone(tz)
        if local_time.weekday() < 5:
            start = datetime.time(9, 30)
            end = datetime.time(16, 0)
            return start <= local_time.time() <= end
            
    return False

def get_active_user_ids(minutes=10):
    """取得最近活躍用戶 ID 列表"""
    threshold = (datetime.datetime.now(pytz.utc) - datetime.timedelta(minutes=minutes)).isoformat()
    try:
        res = supabase.table("profiles").select("id").gt("last_seen", threshold).execute()
        return [user['id'] for user in res.data]
    except Exception as e:
        print(f"⚠️ 無法取得活躍用戶列表: {e}")
        return []

# --- 數據抓取核心 ---

def calculate_indicators(df):
    """計算技術指標：MA20, Bollinger Bands, RSI"""
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
    """核心抓取邏輯：優先保護名稱，強制補全行情"""
    print(f"🔍 正在同步數據 {market}: {symbol}...")
    data = {"symbol": symbol, "market": market}
    
    try:
        # --- A. 名稱保護機制 (優先從本地 metadata 抓取中文名) ---
        meta = supabase.table("stock_metadata").select("name_zh").eq("symbol", symbol).execute()
        if meta.data and meta.data[0].get("name_zh"):
            data["name"] = meta.data[0]["name_zh"]
        else:
            # 如果主檔沒名字，不填寫 name 欄位，讓資料庫保留用戶手動輸入的值
            pass
        
        yf_stock = yf.Ticker(symbol)
        hist = yf_stock.history(period="1y") 
        if hist.empty: return None
        
        info = yf_stock.info
        hist = calculate_indicators(hist)
        latest = hist.iloc[-1]
        
        # --- B. 價格與漲跌幅補全 ---
        cur_price = latest['Close']
        if np.isnan(cur_price) or cur_price == 0:
            cur_price = info.get('regularMarketPrice') or info.get('previousClose')
        
        prev_close = info.get('previousClose')
        if not prev_close and len(hist) > 1:
            prev_close = hist.iloc[-2]['Close'] if not np.isnan(latest['Close']) else hist.iloc[-1]['Close']

        if cur_price:
            cur_price = float(round(cur_price, 2))
            data["current_price"] = cur_price
            if prev_close:
                prev_close = float(prev_close)
                data["change_amount"] = float(round(cur_price - prev_close, 2))
                data["change_percent"] = float(round(((cur_price - prev_close) / prev_close) * 100, 2))

        # --- C. 指標與財務數據更新 ---
        data.update({
            "volume": int(latest['Volume']) if not np.isnan(latest['Volume']) else info.get('volume', 0),
            "high_52w": float(round(hist['High'].max(), 2)),
            "low_52w": float(round(hist['Low'].min(), 2)),
            "ma20_distance": float(round(((cur_price - latest['ma20']) / latest['ma20']) * 100, 2)) if cur_price and not pd.isna(latest['ma20']) else 0,
            "rsi_14": float(round(latest['rsi_14'], 2)) if not pd.isna(latest['rsi_14']) else None,
            "bb_upper": float(round(latest['bb_upper'], 2)) if not pd.isna(latest['bb_upper']) else None,
            "bb_lower": float(round(latest['bb_lower'], 2)) if not pd.isna(latest['bb_lower']) else None,
            "eps": info.get('trailingEps'),
            "net_value_per_share": info.get('bookValue'),
            "pe_ratio": info.get('trailingPE'),
            "pb_ratio": info.get('priceToBook'),
            "roe": (info.get('returnOnEquity', 0) * 100) if info.get('returnOnEquity') else None,
            "cash_dividend": info.get('dividendRate') or info.get('trailingAnnualDividendRate'),
            "updated_at": datetime.datetime.now(pytz.utc).isoformat()
        })

        # 趨勢訊號判斷
        if data.get("rsi_14") is not None:
            if data["rsi_14"] > 70: data["trend_signal"] = "超買(過熱)"
            elif data["rsi_14"] < 30: data["trend_signal"] = "超跌(反彈)"
            else: data["trend_signal"] = "趨勢中性"

    except Exception as e:
        print(f"❌ {symbol} 抓取發生錯誤: {e}")
        return None

    return clean_numeric_data(data)

# --- 主程序 ---

def sync_active_users_watchlist():
    """執行針對活躍用戶的精準同步任務"""
    print(f"🚀 [{datetime.datetime.now().strftime('%H:%M:%S')}] 啟動按需同步任務...")
    
    # 1. 取得活躍用戶 (10分鐘內有上線打點者)
    active_ids = get_active_user_ids(minutes=10)
    if not active_ids:
        print("😴 目前無活躍用戶，跳過高頻更新。")
        return

    # 2. 取得活躍用戶的所有觀察清單項目
    try:
        response = supabase.table("watchlist").select("user_id, symbol, market").in_("user_id", active_ids).execute()
        watchlist_items = response.data
        if not watchlist_items: return
    except Exception as e:
        print(f"❌ 讀取資料失敗: {e}"); return

    # 3. 過濾出當前正在開盤的唯一股票清單
    unique_stocks = []
    seen = set()
    for item in watchlist_items:
        symbol, market = item['symbol'], item['market']
        if (symbol, market) not in seen and is_market_open(market):
            unique_stocks.append((symbol, market))
            seen.add((symbol, market))

    if not unique_stocks:
        print("🌙 目標市場皆已收盤，暫不更新即時價格。")
        return

    # 4. 抓取數據並緩存
    stock_cache = {}
    for symbol, market in unique_stocks:
        master_data = get_stock_data_master(symbol, market)
        if master_data:
            stock_cache[symbol] = master_data
            
            # 更新公共歷史表 (用於繪製趨勢圖)
            history_entry = {
                "symbol": symbol, "trade_date": pd.Timestamp.now().strftime("%Y-%m-%d"),
                "close_price": master_data["current_price"], "volume": master_data["volume"],
                "rsi_14": master_data.get("rsi_14")
            }
            try: 
                supabase.table("stock_history").upsert(history_entry, on_conflict="symbol,trade_date").execute()
            except: 
                pass 
            
        # 關鍵：隨機延遲 1.5 ~ 3 秒，模擬人為抓取節奏，防 IP 封鎖
        time.sleep(random.uniform(1.5, 3.0))

    # 5. 分發數據更新至各活躍用戶的資料表
    print(f"📦 開始分發數據至 {len(watchlist_items)} 個用戶項目...")
    for item in watchlist_items:
        symbol, user_id = item['symbol'], item['user_id']
        if symbol in stock_cache:
            # 複製快照數據，但不包含 name 欄位 (除非 cache 裡有正確名稱)
            payload = stock_cache[symbol].copy()
            payload["user_id"] = user_id
            
            try:
                # 執行 Upsert：如果 (user_id, symbol) 已存在則更新數據
                supabase.table("watchlist").upsert(payload, on_conflict="user_id,symbol").execute()
                print(f"✅ 更新成功: {symbol} (用戶: {user_id[:8]})")
            except Exception as e:
                print(f"❌ 分發失敗 {symbol}: {e}")

if __name__ == "__main__":
    sync_active_users_watchlist()