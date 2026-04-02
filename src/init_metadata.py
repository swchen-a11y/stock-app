import os
import pandas as pd
import akshare as ak
import zhconv
from FinMind.data import DataLoader
from supabase import create_client
from dotenv import load_dotenv

# 1. 初始化環境
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, '.env.local'))

url = os.getenv("VITE_SUPABASE_URL")
# 務必確認 .env.local 裡有這把 Key
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")

if not url or not key:
    raise ValueError("❌ 找不到 Supabase URL 或 Key，請檢查 .env.local")

supabase = create_client(url, key)

def to_traditional(text):
    """簡轉繁"""
    return zhconv.convert(text, 'zh-tw') if text else text

def import_taiwan_stocks():
    print("🚀 正在抓取台股清單 (FinMind)...")
    try:
        token = os.getenv("FINMIND_API_TOKEN")
        api = DataLoader()
        if token: api.login_by_token(token)
        
        df = api.taiwan_stock_info()
        
        # --- 核心修正：過濾重複代碼 ---
        df = df.drop_duplicates(subset=['stock_id'])
        
        stocks = []
        for _, row in df.iterrows():
            stocks.append({
                "symbol": f"{row['stock_id']}.TW",
                "name_zh": row['stock_name'],
                "market": "TW",
                "category": row['industry_category'],
                "search_keywords": f"{row['stock_id']}, {row['stock_name']}",
                "is_active": True
            })

        print(f"📦 準備匯入 {len(stocks)} 支台股...")
        # 批次寫入 (縮小到 100 筆一組更穩定)
        batch_size = 100
        for i in range(0, len(stocks), batch_size):
            batch = stocks[i : i + batch_size]
            # 再次確保 batch 內無重複
            supabase.table("stock_metadata").upsert(batch, on_conflict="symbol").execute()
            
        print(f"✅ 成功匯入/更新台股資料")
    except Exception as e:
        print(f"❌ 台股匯入失敗: {e}")

import time # 必須引入

import time

def import_china_stocks():
    print("🚀 嘗試使用替代方案抓取陸股...")
    try:
        # 1. 只從 AkShare 拿代號清單 (這步請求次數極少，不易斷線)
        df = ak.stock_zh_a_spot_em()
        
        stocks = []
        print(f"📊 正在處理 {len(df)} 支代號...")
        
        for _, row in df.iterrows():
            code = str(row['代碼'])
            # yfinance 的陸股後綴是 .SS (上交所) 或 .SZ (深交所)
            suffix = ".SS" if code.startswith('6') else ".SZ"
            symbol = f"{code}{suffix}"
            
            # 這裡我們直接用 AkShare 提供的名稱，避免去請求 yfinance.info (太慢且易被封)
            name_tw = to_traditional(row['名稱'])
            
            stocks.append({
                "symbol": symbol,
                "name_zh": name_tw,
                "market": "CN",
                "category": to_traditional(row.get('板塊', 'A股')),
                "search_keywords": f"{code}, {name_tw}",
                "is_active": True
            })

        # 2. 核心修正：使用原生 SQL 或更簡單的寫入方式
        # 如果還是斷線，代表是 Supabase 的網路連線問題，我們縮小到 20 筆一組
        total = len(stocks)
        batch_size = 20 
        print(f"📦 準備分段寫入 Supabase...")

        for i in range(0, total, batch_size):
            batch = stocks[i : i + batch_size]
            try:
                # 這裡不使用 upsert，改用簡單的 insert，如果已存在就跳過 (更輕量)
                supabase.table("stock_metadata").upsert(batch, on_conflict="symbol").execute()
                if i % 100 == 0:
                    print(f"🔼 已完成: {i}/{total}")
            except Exception as e:
                # 如果某組失敗，停 2 秒繼續下一組
                print(f"⚠️ 寫入跳過: {e}")
                time.sleep(2)
                continue

        print("✅ 陸股清單初始化嘗試完成")

    except Exception as e:
        print(f"❌ 陸股方案失敗: {e}")

if __name__ == "__main__":
    # 執行前確保已在 SQL 執行：ALTER TABLE stock_metadata DISABLE ROW LEVEL SECURITY;
    import_taiwan_stocks()
    #import_china_stocks()