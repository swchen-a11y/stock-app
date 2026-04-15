import os
import time
import yfinance as yf
import pandas as pd
import numpy as np
import datetime
import akshare as ak
from finmind.data import DataLoader
from supabase import create_client
from dotenv import load_dotenv

# --- 1. 環境初始化 ---
def init_supabase():
    current_file = os.path.abspath(__file__)
    root_dir = os.path.dirname(os.path.dirname(current_file))
    env_path = os.path.join(root_dir, '.env.local')
    if os.path.exists(env_path):
        load_dotenv(env_path)

    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    finmind_token = os.getenv("FINMIND_API_TOKEN")
    
    return create_client(url, key.strip()), finmind_token

supabase, FINMIND_TOKEN = init_supabase()

def clean_val(val, default=0.0):
    if val is None or pd.isna(val) or val == "" or val == "-" or val == "None": return default
    try:
        v = float(val)
        return v if not (np.isnan(v) or np.isinf(v)) else default
    except: return default

# --- 2. 精確匹配 A 股數據 (AkShare) ---

def get_china_data_from_ak(symbol):
    """
    根據官方文件修正：代碼必須去後綴，且欄位名稱為簡體「代码」、「市盈率-動態」等
    """
    try:
        # 將 000651.SZ 轉為 000651
        pure_code = symbol.split('.')[0]
        df_all = ak.stock_zh_a_spot_em()
        
        # 關鍵：AkShare 返回的是字串格式的代碼
        row = df_all[df_all['代码'] == pure_code]
        
        if not row.empty:
            res = row.iloc[0]
            print(f"📊 AkShare 匹配成功: {pure_code} ({res.get('名称')})")
            return {
                "market_cap": clean_val(res.get('总市值')),
                "pe_ratio": clean_val(res.get('市盈率-动态')),
                "pb_ratio": clean_val(res.get('市净率')),
                "current_price": clean_val(res.get('最新价')),
                "volume": int(clean_val(res.get('成交量'))) * 100, # 手轉股
                "day_high": clean_val(res.get('最高')),
                "day_low": clean_val(res.get('最低')),
                "open_price": clean_val(res.get('今开')),
                "prev_close": clean_val(res.get('昨收'))
            }
    except Exception as e:
        print(f"⚠️ AkShare 抓取失敗 ({symbol}): {e}")
    return {}

# --- 3. 主執行邏輯 ---

def fetch_and_sync(symbol):
    try:
        # A. 優先獲取專業數據源 (AkShare / FinMind)
        region_data = {}
        if symbol.endswith(('.SZ', '.SS')):
            region_data = get_china_data_from_ak(symbol)
        
        # B. 調用 yfinance 獲取歷史數據計算技術指標 (這部分你之前的數據顯示已成功)
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="60d")
        
        payload = {
            "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        if not hist.empty:
            latest = hist.iloc[-1]
            # 如果 AkShare 沒抓到行情，用 yfinance 補
            if clean_val(region_data.get("current_price")) == 0:
                region_data["current_price"] = clean_val(latest['Close'])
            
            # 計算 RSI 14
            delta = hist['Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean().iloc[-1]
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean().iloc[-1]
            payload["rsi_14"] = clean_val(100 - (100 / (1 + (gain/loss)))) if loss != 0 else 100
            
            # MA20 乖離率
            ma20 = hist['Close'].rolling(window=20).mean().iloc[-1]
            payload["ma20_distance"] = clean_val((latest['Close'] - ma20) / ma20 * 100)
            payload["trend_signal"] = "多頭" if latest['Close'] > ma20 else "空頭"

        # C. yfinance 基本面補強 (Fallback)
        # 如果 region_data 裡的關鍵數值還是 0，則瘋狂嘗試 yfinance 的 info
        yf_info = ticker.info if ticker.info else {}
        mapping = {
            "market_cap": "marketCap",
            "pe_ratio": "trailingPE",
            "pb_ratio": "priceToBook",
            "high_52w": "fiftyTwoWeekHigh",
            "low_52w": "fiftyTwoWeekLow",
            "eps": "trailingEps"
        }

        payload.update(region_data)

        for db_key, yf_key in mapping.items():
            if clean_val(payload.get(db_key)) == 0:
                val = yf_info.get(yf_key)
                payload[db_key] = clean_val(val)

        # D. 強制檢查：如果這時候還是空的，給予最後的預設值，防止欄位保持 NULL
        # 這樣至少你會在資料庫看到 0.0 而不是完全沒更新
        
        # E. 更新 Supabase
        update_res = supabase.table("watchlist").update(payload).eq("symbol", symbol).execute()
        if update_res.data:
            print(f"✅ {symbol} 同步完成，已更新 {len(payload)} 個欄位")
        else:
            print(f"❓ {symbol} 更新似乎未成功，請檢查資料庫 RLS 權限")
            
        return True
    except Exception as e:
        print(f"❌ {symbol} 發生未知錯誤: {e}")
        return False

def main():
    res = supabase.table("watchlist").select("symbol").execute()
    for row in res.data:
        fetch_and_sync(row['symbol'])
        time.sleep(1) # 禮貌性延遲

if __name__ == "__main__":
    main()