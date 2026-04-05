import os
import time
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
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # 必須使用 Service Role Key

if not url or not key:
    raise ValueError("❌ 找不到 Supabase 配置")

supabase = create_client(url, key)

def to_traditional(text):
    if not text: return text
    return zhconv.convert(text, 'zh-tw')

def import_taiwan_stocks():
    """從 FinMind 抓取台股清單"""
    print("🚀 正在抓取台股清單 (FinMind)...")
    try:
        api = DataLoader()
        token = os.getenv("FINMIND_API_TOKEN")
        if token: api.login_by_token(token)
        
        df = api.taiwan_stock_info()
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
        batch_write(stocks, "台股")
    except Exception as e:
        print(f"❌ 台股匯入失敗: {e}")

def import_china_stocks():
    """從 AkShare 抓取陸股清單 (A股)"""
    print("🚀 正在從 AkShare 抓取陸股清單...")
    try:
        df = ak.stock_zh_a_spot_em()
        if df.empty: return

        stocks = []
        for _, row in df.iterrows():
            code = str(row['代碼'])
            suffix = ".SS" if code.startswith('6') else ".SZ"
            symbol = f"{code}{suffix}"
            name_tw = to_traditional(row['名稱'])
            
            stocks.append({
                "symbol": symbol,
                "name_zh": name_tw,
                "market": "CN",
                "category": "A股",
                "search_keywords": f"{code}, {name_tw}",
                "is_active": True
            })
        batch_write(stocks, "陸股")
    except Exception as e:
        print(f"❌ 陸股匯入失敗: {e}")

def batch_write(stocks, label, batch_size=200):
    total = len(stocks)
    print(f"📦 準備匯入 {total} 支 {label} 資料...")
    for i in range(0, total, batch_size):
        batch = stocks[i : i + batch_size]
        try:
            supabase.table("stock_metadata").upsert(batch, on_conflict="symbol").execute()
            if i % 1000 == 0: print(f"✅ {label} 進度: {i}/{total}")
        except Exception as e:
            print(f"⚠️ 批次 {i} 失敗，嘗試逐筆跳過錯誤...")
            time.sleep(1)
        time.sleep(0.1)

if __name__ == "__main__":
    # 建議順序：先確保台股完整
    import_taiwan_stocks()
    # 如果你決定讓用戶自行新增陸股，可以註解掉下面這行
    # import_china_stocks()
    print("✨ 初始化完成")