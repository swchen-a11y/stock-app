import os
import time
import yfinance as yf
import pandas as pd
import numpy as np
import datetime
import pytz
from supabase import create_client
from dotenv import load_dotenv

# --- 1. 初始化環境 (確保支援 GitHub Actions 與本地環境) ---
def init_supabase():
    # 本地開發時嘗試加載 .env.local
    current_file = os.path.abspath(__file__)
    root_dir = os.path.dirname(os.path.dirname(current_file))
    env_path = os.path.join(root_dir, '.env.local')
    if os.path.exists(env_path):
        load_dotenv(env_path)

    # 優先讀取系統環境變數 (GitHub Secrets 會注入此處)
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        raise ValueError("❌ 缺失 SUPABASE_URL 或 SUPABASE_SERVICE_KEY。請檢查 GitHub Secrets 設定。")
    
    # 清除 key 可能存在的換行符或空格
    key = key.strip()
    return create_client(url, key)

supabase = init_supabase()

def clean_val(val, default=0.0):
    """ 強制轉換為 Python 原生 float 並處理異常值 """
    if val is None or pd.isna(val): return default
    try:
        v = float(val)
        return v if not (np.isnan(v) or np.isinf(v)) else default
    except: return default

# --- 2. 市場開盤判斷 ---
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
    if df.empty or len(df) < 2: return None
    
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
    
    if len(df) >= 10:
        # 取最後 10 筆數據的成交量平均值
        avg_vol_10 = df['Volume'].tail(10).mean()
        d["avg_volume_10d"] = int(clean_val(avg_vol_10))
    else:
        # 若數據不足 10 筆，則取現有數據的平均值作為初始參考
        d["avg_volume_10d"] = int(clean_val(df['Volume'].mean()))

    if len(df) >= 20:
        ma20 = float(close_s.rolling(window=20).mean().iloc[-1])
        std20 = float(close_s.rolling(window=20).std().iloc[-1])
        d["ma20_distance"] = ((d["current_price"] - ma20) / ma20 * 100) if ma20 != 0 else 0
        d["bb_upper"] = clean_val(ma20 + (std20 * 2))
        d["bb_lower"] = clean_val(ma20 - (std20 * 2))
        
        delta = close_s.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        d["rsi_14"] = clean_val(100 - (100 / (1 + rs.iloc[-1])))
        
        if d["rsi_14"] > 70: d["trend_signal"] = "超買"
        elif d["rsi_14"] < 30: d["trend_signal"] = "超賣"
        else: d["trend_signal"] = "多頭" if d["current_price"] > ma20 else "空頭"
    
    return d

# --- 4. 同步主程序 ---
def sync():
    print(f"🚀 同步任務啟動: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        watch_res = supabase.table("watchlist").select("*").execute()
    except Exception as e:
        print(f"❌ 無法連接 Supabase: {e}")
        return

    items = watch_res.data
    if not items: 
        print("⚠️ Watchlist 為空。")
        return

    active_symbols = []
    for i in items:
        # 強制更新條件：開盤中、無數據或為了初始化
        if is_market_open(i['market']) or i.get('current_price') == 0 or i.get('current_price') is None:
            active_symbols.append(i['symbol'])
    
    active_symbols = list(set(active_symbols))
    if not active_symbols:
        print("💤 所有市場休市中。")
        return

    print(f"📦 正在同步 {len(active_symbols)} 支股票...")
    all_data = yf.download(active_symbols, period="60d", group_by='ticker', threads=True, progress=False)

    # 創建符號到項目的映射，用於獲取 updated_at
    item_by_symbol = {item['symbol']: item for item in items}
    
    for symbol in active_symbols:
        try:
            df = all_data[symbol].copy() if len(active_symbols) > 1 else all_data.copy()
            payload = process_indicators(df)
            if not payload: continue

            # 檢查是否需要更新基本面數據（Low Frequency）
            item = item_by_symbol.get(symbol)
            need_fundamental_update = True
            
            if item:
                # 檢查基本面數據是否缺失（eps 為空或0）
                eps_missing = not item.get('eps') or float(item.get('eps') or 0) == 0
                
                # 檢查 updated_at 是否超過24小時
                updated_too_old = False
                if item.get('updated_at'):
                    try:
                        updated_at = datetime.datetime.fromisoformat(item['updated_at'].replace('Z', '+00:00'))
                        now = datetime.datetime.now(pytz.utc)
                        hours_diff = (now - updated_at).total_seconds() / 3600
                        updated_too_old = hours_diff >= 24
                    except Exception as e:
                        print(f"⚠️ {symbol} 解析 updated_at 失敗: {e}")
                        updated_too_old = True
                
                # 需要更新基本面數據的條件：數據缺失 或 updated_at 超過24小時
                need_fundamental_update = eps_missing or updated_too_old
                
                if not need_fundamental_update:
                    print(f"📊 {symbol} 基本面數據仍在 24 小時快取期內且數據完整，僅更新行情數據")
                else:
                    if eps_missing:
                        print(f"📈 {symbol} 基本面數據缺失，觸發完整更新")
                    else:
                        print(f"📈 {symbol} 基本面數據已超過 24 小時，觸發完整更新")
            else:
                print(f"⚠️ {symbol} 未在 watchlist 中找到對應項目，進行完整更新")

            # 抓取基礎財務數據 (用於 AI 分析) - 僅當需要時
            if need_fundamental_update:
                ticker_obj = yf.Ticker(symbol)
                inf = ticker_obj.info
                
                # 修正殖利率計算邏輯
                dividend_yield_raw = inf.get('dividendYield')
                dividend_yield_cleaned = clean_val(dividend_yield_raw)
                if dividend_yield_cleaned != 0:
                    # 若原始數據 < 1 則 * 100，否則保持原樣（假設原始數據已經是百分比）
                    if dividend_yield_cleaned < 1:
                        dividend_yield_cleaned *= 100
                else:
                    dividend_yield_cleaned = 0
                
                payload.update({
                    "market_cap": clean_val(inf.get('marketCap')),
                    "eps": clean_val(inf.get('trailingEps')),
                    "roe": clean_val(inf.get('returnOnEquity')) * 100,
                    "cash_dividend": clean_val(inf.get('dividendRate')),
                    "net_value_per_share": clean_val(inf.get('bookValue')),
                    "high_52w": clean_val(inf.get('fiftyTwoWeekHigh')),
                    "low_52w": clean_val(inf.get('fiftyTwoWeekLow')),
                    "pb_ratio": clean_val(inf.get('priceToBook')),
                    "pe_ratio": clean_val(inf.get('trailingPE')),
                    "dividend_yield": dividend_yield_cleaned
                })
                print(f"📈 {symbol} 更新完整數據（行情 + 基本面）")
            else:
                print(f"📊 {symbol} 僅更新行情數據")

            trade_date = payload.pop("trade_date")

            # 1. 更新 Watchlist
            supabase.table("watchlist").update(payload).eq("symbol", symbol).execute()

            # 2. 更新 stock_history (歷史快取)
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
            
            # 添加延遲，降低被偵測為爬蟲的風險
            time.sleep(1)

        except Exception as e:
            print(f"❌ {symbol} 失敗: {e}")

    print("✨ 同步結束。")

if __name__ == "__main__":
    sync()