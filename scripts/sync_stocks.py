import os
import yfinance as yf
import pandas as pd
import numpy as np
import datetime
import pytz
import time
from supabase import create_client
from dotenv import load_dotenv

# --- 1. 初始化 ---
current_file = os.path.abspath(__file__)
root_dir = os.path.dirname(os.path.dirname(current_file))
env_path = os.path.join(root_dir, '.env.local')
if os.path.exists(env_path):
    load_dotenv(env_path)

url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

def clean_val(val, default=0.0):
    if val is None or pd.isna(val): return default
    try:
        v = float(val)
        return v if not (np.isnan(v) or np.isinf(v)) else default
    except: return default

# --- 2. 市場開盤判斷 (增加收盤後緩衝時間) ---
def is_market_open(market="US"):
    now = datetime.datetime.now(pytz.utc)
    
    if market == "US":
        et_tz = pytz.timezone('US/Eastern')
        now_et = now.astimezone(et_tz)
        if now_et.weekday() >= 5: return False
        # 允許更新到 17:00 (收盤後1小時) 確保抓到最終價
        return datetime.time(9, 30) <= now_et.time() <= datetime.time(17, 0)
    
    elif market in ["TW", "CN"]:
        tw_tz = pytz.timezone('Asia/Taipei')
        now_tw = now.astimezone(tw_tz)
        if now_tw.weekday() >= 5: return False
        
        t = now_tw.time()
        if market == "TW":
            # 延後到 14:30
            return datetime.time(9, 0) <= t <= datetime.time(14, 30)
        elif market == "CN":
            morning = datetime.time(9, 30) <= t <= datetime.time(11, 30)
            # 延後到 16:00
            afternoon = datetime.time(13, 0) <= t <= datetime.time(16, 0)
            return morning or afternoon
            
    return True

# --- 3. 技術指標計算函數 ---
def process_indicators(df):
    if df.empty or len(df) < 20: return None
    
    df = df.dropna(subset=['Close'])
    last = df.iloc[-1]
    prev = df.iloc[-2] if len(df) > 1 else last
    close_s = df['Close']
    
    d = {
        "current_price": clean_val(last['Close']),
        "prev_close": clean_val(prev['Close']),
        "open_price": clean_val(last['Open']),
        "day_high": clean_val(last['High']),
        "day_low": clean_val(last['Low']),
        "volume": int(clean_val(last['Volume'])),
        "trade_date": last.name.strftime('%Y-%m-%d') # 提取日期用於歷史表
    }
    
    d["change_amount"] = d["current_price"] - d["prev_close"]
    d["change_percent"] = (d["change_amount"] / d["prev_close"] * 100) if d["prev_close"] != 0 else 0
    
    ma20 = close_s.rolling(window=20).mean().iloc[-1]
    std20 = close_s.rolling(window=20).std().iloc[-1]
    d["ma20_distance"] = ((d["current_price"] - ma20) / ma20 * 100) if ma20 != 0 else 0
    d["bb_upper"] = clean_val(ma20 + (std20 * 2))
    d["bb_lower"] = clean_val(ma20 - (std20 * 2))
    
    delta = close_s.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    d["rsi_14"] = clean_val(100 - (100 / (1 + rs.iloc[-1])))
    
    if d["rsi_14"] > 70: d["trend_signal"] = "超買 (回檔風險)"
    elif d["rsi_14"] < 30: d["trend_signal"] = "超賣 (反彈機會)"
    else: d["trend_signal"] = "多頭趨勢" if d["current_price"] > ma20 else "空頭趨勢"
    
    return d

# --- 4. 同步主程序 ---
def sync():
    print(f"🚀 高效同步啟動: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    watch_res = supabase.table("watchlist").select("*").execute()
    items = watch_res.data
    if not items: return

    all_symbols = [i['symbol'] for i in items]
    active_symbols = []
    symbol_to_market = {i['symbol']: i['market'] for i in items}
    
    for i in items:
        # 條件：開盤中、價格為空、或是名稱/分類為空 (確保新股票必更新)
        if is_market_open(i['market']) or i.get('current_price') is None or i.get('category') is None:
            active_symbols.append(i['symbol'])
    
    active_symbols = list(set(active_symbols))
    if not active_symbols:
        print("💤 所有市場休市中且數據已補全。")
        return

    print(f"📦 正在批次下載 {len(active_symbols)} 支個股數據...")
    all_data = yf.download(active_symbols, period="60d", group_by='ticker', threads=True, progress=False)
    meta_map = {m['symbol']: m for m in supabase.table("stock_metadata").select("*").in_("symbol", all_symbols).execute().data}

    for symbol in active_symbols:
        try:
            if isinstance(all_data.columns, pd.MultiIndex):
                df = all_data[symbol].copy()
            else:
                df = all_data.copy()

            payload = process_indicators(df)
            if not payload: continue

            # 補全 Metadata 與財務
            current_watchlist_item = next((i for i in items if i['symbol'] == symbol), {})
            if symbol not in meta_map or current_watchlist_item.get('category') is None:
                print(f"🔍 正在補全 {symbol} 的初始分類與財務資料...")
                t = yf.Ticker(symbol)
                inf = t.info
                category = inf.get('sector') or inf.get('industry') or "未知分類"
                name_zh = inf.get('longName') or inf.get('shortName') or symbol
                
                payload.update({
                    "market_cap": clean_val(inf.get('marketCap')),
                    "eps": clean_val(inf.get('trailingEps') or inf.get('forwardEps')),
                    "roe": clean_val(inf.get('returnOnEquity')) * 100,
                    "cash_dividend": clean_val(inf.get('dividendRate')),
                    "net_value_per_share": clean_val(inf.get('bookValue')),
                    "high_52w": clean_val(inf.get('fiftyTwoWeekHigh')),
                    "low_52w": clean_val(inf.get('fiftyTwoWeekLow')),
                })
                if payload['eps'] != 0: payload["pe_ratio"] = payload["current_price"] / payload["eps"]
                if payload['net_value_per_share'] != 0: payload["pb_ratio"] = payload["current_price"] / payload["net_value_per_share"]
                
                supabase.table("stock_metadata").upsert({
                    "symbol": symbol,
                    "name_zh": name_zh,
                    "market": symbol_to_market.get(symbol, "CN"),
                    "category": category
                }, on_conflict="symbol").execute()

            # 提取 trade_date 用於 history 並從 payload 移除(避免更新到 watchlist 不存在的欄位)
            trade_date = payload.pop("trade_date")

            # 1. 更新 Watchlist
            supabase.table("watchlist").update(payload).eq("symbol", symbol).execute()

            # 2. 寫入 stock_history (使用 upsert 避免重複記錄同一天)
            # 建議 history 表欄位：id(uuid), symbol, trade_date, close_price, volume, change_percent
            history_payload = {
                "symbol": symbol,
                "trade_date": trade_date,
                "close_price": payload["current_price"],
                "volume": payload["volume"],
                "change_percent": payload["change_percent"]
            }
            supabase.table("stock_history").upsert(
                history_payload, on_conflict="symbol, trade_date"
            ).execute()

            print(f"✅ {symbol} 同步完成 (含歷史記錄)")

        except Exception as e:
            print(f"❌ {symbol} 同備失敗: {e}")

    print("✨ 同步任務完成。")

if __name__ == "__main__":
    sync()