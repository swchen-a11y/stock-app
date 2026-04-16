import { NextResponse } from 'next/server';

export async function POST() {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // 👈 從環境變數抓取
  
  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: '未設定 Token' }, { status: 500 });
  }

  const response = await fetch(
    `https://api.github.com/repos/swchen-a11y/stock-app/actions/workflows/stock_sync.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  );

  if (response.status === 204) {
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json({ error: '觸發失敗' }, { status: 500 });
  }
}