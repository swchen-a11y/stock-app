import os
import yfinance as yf
import pandas as pd
import numpy as np
import datetime
import pytz
from supabase import create_client
from dotenv import load_dotenv

# --- 1. 初始化環境 (優先讀取 GitHub Actions 環境變數) ---
def init_supabase():
    # 嘗試加載本地環境變數檔案 (僅在開發環境有效)
    current_file = os.path.abspath(__file__)
    root_dir = os.path.dirname(os.path.dirname(current_file))
    env_path = os.path.join(root_dir, '.env.local')
    if os.path.exists(env_path):
        load_dotenv(env_path)

    # 優先從環境中獲取，若無則報錯 (GitHub Actions 會直接注入環境變數)
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        raise ValueError("❌ 找不到 Supabase URL 或 KEY，請檢查 GitHub Secrets 或 .env 檔案")
    
    return create_client(url, key)

supabase = init_supabase()

def clean_val(val, default=0.0):
    if val is None or pd.isna(val): return default
    try:
        v = float(val)
        return v if not (np.isnan(v) or np.isinf(v)) else default
    except: return default

# --- 2. 市場開盤判斷 (支援台股、陸股、美股) ---
def is_market_open(market="US"):
    now = datetime.datetime.now(pytz.utc)
    
    if market == "US":
        et_tz = pytz.timezone('US/Eastern')
        now_et = now.astimezone(et_tz)
        if now_et.weekday() >= 5: return False
        return datetime.time(9, 30) <= now_et.time() <= datetime.time(17, 0)
    
    elif market in ["TW", "CN"]:
        tw_tz = pytz.timezone('Asia/Taipei')
        now_tw = now.astimezone(tw_tz)
        if now_tw.weekday() >= 5: return False
        t = now_tw.time()
        if market == "TW":
            return datetime.time(9, 0) <= t <= datetime.time(14, 30)
        elif market == "CN":
            morning = datetime.time(9, 30) <= t <= datetime.time(11, 30)
            afternoon = datetime.time(13, 0) <= t <= datetime.time(16, 0)
            return morning or afternoon
            
    return True

# --- 3. 技術指標計算 ---
def process_indicators(df):
    if df.empty or len(df) < 2: return None # 至少需要兩天資料
    
    df = df.dropna(subset=['Close'])
    last = df.iloc[-1]
    prev = df.iloc[-2]
    close_s = df['Close']
    
    d = {
        "current_price": clean_val(last['Close']),
        "prev_close": clean_val(prev['Close']),
        "open_price": clean_val(last['Open']),
        "day_high": clean_val(last['High']),
        "day_low": clean_val(last['Low']),
        "volume": int(clean_val(last['Volume'])),
        "trade_date": last.name.strftime('%Y-%m-%d')
    }
    
    d["change_amount"] = d["current_price"] - d["prev_close"]
    d["change_percent"] = (d["change_amount"] / d["prev_close"] * 100) if d["prev_close"] != 0 else 0
    
    # 計算 MA20 與 布林通道
    if len(df) >= 20:
        ma20 = close_s.rolling(window=20).mean().iloc[-1]
        std20 = close_s.rolling(window=20).std().iloc[-1]
        d["ma20_distance"] = ((d["current_price"] - ma20) / ma20 * 100) if ma20 != 0 else 0
        d["bb_upper"] = clean_val(ma20 + (std20 * 2))
        d["bb_lower"] = clean_val(ma20 - (std20 * 2))
        
        # RSI 計算
        delta = close_s.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        d["rsi_14"] = clean_val(100 - (100 / (1 + rs.iloc[-1])))
        
        # 趨勢信號
        if d["rsi_14"] > 70: d["trend_signal"] = "超買 (回檔風險)"
        elif d["rsi_14"] < 30: d["trend_signal"] = "超賣 (反彈機會)"
        else: d["trend_signal"] = "多頭趨勢" if d["current_price"] > ma20 else "空頭趨勢"
    
    return d

# --- 4. 同步主程序 ---
def sync():
    print(f"🚀 GitHub Actions 同步任務啟動: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    watch_res = supabase.table("watchlist").select("*").execute()
    items = watch_res.data
    if not items: 
        print("⚠️ Watchlist 為空，結束任務。")
        return

    all_symbols = [i['symbol'] for i in items]
    active_symbols = []
    
    for i in items:
        # 強制更新條件：開盤中、無價格數據或為新添加的股票
        if is_market_open(i['market']) or i.get('current_price') is None or i.get('category') is None:
            active_symbols.append(i['symbol'])
    
    active_symbols = list(set(active_symbols))
    if not active_symbols:
        print("💤 所有市場休市中且數據充足。")
        return

    print(f"📦 正在下載 {len(active_symbols)} 支個股的歷史與財務數據...")
    all_data = yf.download(active_symbols, period="60d", group_by='ticker', threads=True, progress=False)

    for symbol in active_symbols:
        try:
            df = all_data[symbol].copy() if len(active_symbols) > 1 else all_data.copy()
            payload = process_indicators(df)
            if not payload: continue

            # 補全財務指標 (從 yfinance 抓取 info)
            ticker_obj = yf.Ticker(symbol)
            inf = ticker_obj.info
            
            # 更新財務資料 (用於 AI 分析的全量數據)
            payload.update({
                "market_cap": clean_val(inf.get('marketCap')),
                "eps": clean_val(inf.get('trailingEps') or inf.get('forwardEps')),
                "roe": clean_val(inf.get('returnOnEquity')) * 100,
                "cash_dividend": clean_val(inf.get('dividendRate')),
                "net_value_per_share": clean_val(inf.get('bookValue')),
                "high_52w": clean_val(inf.get('fiftyTwoWeekHigh')),
                "low_52w": clean_val(inf.get('fiftyTwoWeekLow')),
                "pb_ratio": clean_val(inf.get('priceToBook')),
                "pe_ratio": clean_val(inf.get('trailingPE')),
                "dividend_yield": clean_val(inf.get('dividendYield')) * 100 if inf.get('dividendYield') else 0
            })

            # 暫存日期並從 payload 移除，避免寫入 watchlist 出錯
            trade_date = payload.pop("trade_date")

            # 1. 更新 Watchlist (主表格)
            supabase.table("watchlist").update(payload).eq("symbol", symbol).execute()

            # 2. 更新 stock_history (歷史資料表，含完整的 OHLCV)
            history_payload = {
                "symbol": symbol,
                "trade_date": trade_date,
                "close_price": payload["current_price"],
                "open_price": payload["open_price"],
                "high_price": payload["day_high"],
                "low_price": payload["day_low"],
                "volume": payload["volume"],
                "change_percent": payload["change_percent"]
            }
            supabase.table("stock_history").upsert(
                history_payload, on_conflict="symbol, trade_date"
            ).execute()

            print(f"✅ {symbol} 同步完成")

        except Exception as e:
            print(f"❌ {symbol} 同步失敗: {e}")

    print("✨ 所有同步任務執行完畢。")

if __name__ == "__main__":
    sync()