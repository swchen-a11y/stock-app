/** @type {import('next').NextConfig} */
const nextConfig = {
  // 啟用 React Strict Mode 以捕捉潛在問題
  reactStrictMode: true,
  
  // 優化圖片處理
  images: {
    domains: [],
    formats: ['image/avif', 'image/webp'],
  },
  
  // 優化 RSC (React Server Components) 行為
  experimental: {
    // 優化伺服器動作
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // 優化預取行為
    optimisticClientCache: true,
  },
  
  // 編譯器配置
  compiler: {
    // 移除 console.log、info、debug，保留 error 與 warn
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  },
  
  // 環境變數配置
  env: {
    // 可在這裡定義環境變數
  },
  
  // 自定義 headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  
  // 重定向配置（如果需要）
  async redirects() {
    return [];
  },
  
  // 重寫配置（如果需要）
  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;