import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  // 1. 從環境變數讀取 Token (安全性關鍵)
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OWNER = 'swchen-a11y';
  const REPO = 'stock-app';
  const WORKFLOW_ID = 'stock_sync.yml';

  // 檢查 Token 是否存在
  if (!GITHUB_TOKEN) {
    console.error('[Trigger API] 錯誤: 未設定 GITHUB_TOKEN 環境變數');
    return NextResponse.json(
      { success: false, error: '伺服器未設定 GITHUB_TOKEN' },
      { status: 500 }
    );
  }

  try {
    // 設置 10 秒超時，防止 API 請求導致整個 Edge Function 卡住
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          ref: 'main', 
        }),
        signal: controller.signal,
        next: { revalidate: 0 } // 禁用快取
      }
    );

    clearTimeout(timeoutId);

    // GitHub 成功接收請求會回傳 204 No Content
    if (response.status === 204) {
      return NextResponse.json({ 
        success: true, 
        message: 'GitHub Action 已成功觸發！' 
      });
    } else {
      // 嘗試解析錯誤內容，若非 JSON 則抓取 text
      let errorDetails;
      try {
        errorDetails = await response.json();
      } catch (e) {
        errorDetails = await response.text();
      }

      console.error(`[Trigger API] GitHub 回傳錯誤 (${response.status}):`, errorDetails);
      
      return NextResponse.json(
        { success: false, error: 'GitHub 服務回應異常', details: errorDetails },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('[Trigger API] 觸發 Action 失敗:', error);
    
    const errorMessage = error.name === 'AbortError' ? '請求 GitHub 超時' : error.message;
    
    return NextResponse.json(
      { success: false, error: '伺服器內部錯誤', message: errorMessage },
      { status: 500 }
    );
  }
}