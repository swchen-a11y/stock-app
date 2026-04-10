import "./globals.css"; // 確保路徑指向你的 CSS 檔案
import ErrorBoundary from "@/components/Common/ErrorBoundary";

export const metadata = {
  title: 'iOS 股市',
  description: 'AI 驅動的股市分析 App',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <head>
        {/* 防止行動端自動縮放，確保 UI 比例正確 */}
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" 
        />
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