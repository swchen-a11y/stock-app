import { NextResponse } from 'next/server';

export async function POST() {
  // 1. 從環境變數讀取 Token (安全性關鍵)
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OWNER = 'swchen-a11y';
  const REPO = 'stock-app';
  const WORKFLOW_ID = 'stock_sync.yml';

  // 檢查 Token 是否存在
  if (!GITHUB_TOKEN) {
    return NextResponse.json(
      { error: '伺服器未設定 GITHUB_TOKEN' },
      { status: 500 }
    );
  }

  try {
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
          ref: 'main', // 觸發的分支，通常是 main
        }),
      }
    );

    // GitHub 成功接收請求會回傳 204 No Content
    if (response.status === 204) {
      return NextResponse.json({ 
        success: true, 
        message: 'GitHub Action 已成功觸發！請稍候幾分鐘查看 Actions 頁面。' 
      });
    } else {
      const errorData = await response.json();
      return NextResponse.json(
        { error: 'GitHub 回傳錯誤', details: errorData },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('觸發 Action 失敗:', error);
    return NextResponse.json(
      { error: '伺服器內部錯誤', message: error.message },
      { status: 500 }
    );
  }
}