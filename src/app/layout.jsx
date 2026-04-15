import "./globals.css";
import ErrorBoundary from "@/components/Common/ErrorBoundary";

export const metadata = {
  title: "股市",
  description: "AI 驅動的股市分析 App",
  // 透過 Next.js Metadata API 定義行動端設定
  appleWebApp: {
    capable: true,
    title: "股市",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW" className="dark">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover"
        />
        {/* 核心：允許網頁以全螢幕模式運行 (Standalone) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        
        <link rel="apple-touch-icon" href="/stock-touch-icon.png" />
        
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased overflow-hidden fixed inset-0 w-full h-full touch-none">
        <ErrorBoundary>
          <main className="h-screen w-screen overflow-y-auto scrolling-touch">
            {children}
          </main>
        </ErrorBoundary>
      </body>
    </html>
  );
}