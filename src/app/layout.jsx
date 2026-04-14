import "./globals.css"; // 確保路徑指向你的 CSS 檔案
import ErrorBoundary from "@/components/Common/ErrorBoundary";

export const metadata = {
  title: '股市',
  description: 'AI 驅動的股市分析 App',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <head>
        {/* 防止行動端自動縮放 */}
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" 
        />
        
        {/* 修正後的 Apple 觸控圖示 (關鍵在 rel 必須是 apple-touch-icon) */}
        <link rel="apple-touch-icon" href="/stock-touch-icon.png" />
        
        {/* 如果你想讓標題更專業，可以加這行 */}
        <meta name="apple-mobile-web-app-title" content="股市" />
        
        {/* 預先載入關鍵資源 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}