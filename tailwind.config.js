/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // iOS 原生液態玻璃色彩系統
        'ios-red': '#FF453A',   // 系統紅 (用於漲幅)
        'ios-green': '#30D158', // 系統綠 (用於跌幅)
        'ios-blue': '#007AFF',  // 系統藍 (用於按鈕、選單勾選)
        'ios-gray': '#8E8E93',  // 系統灰 (用於副標題、代號)
        'ios-dark-bg': '#000000',
        'ios-card-bg': 'rgba(28, 28, 30, 0.65)',
        'ios-separator': 'rgba(255, 255, 255, 0.1)', // 用於列表分割線
      },
      // iOS 標準圓角規範
      borderRadius: {
        'ios-sm': '6px',   // 用於小型按鈕或標籤
        'ios-md': '8px',   // 用於股市列表的漲跌幅背景
        'ios-lg': '12px',  // 用於卡片或搜尋框
        'ios-xl': '14px',  // 用於系統彈窗 (Alert)
        'ios-2xl': '24px', // 用於 ActionMenu 與 彈窗
        'ios-3xl': '32px', // 用於 AddToGroupModal 這種大型彈窗
      },
      // 模擬玻璃物理厚度的多重陰影系統
      boxShadow: {
        'ios-glass': '0 0 0 0.5px rgba(255, 255, 255, 0.15), inset 0 1px 1.5px rgba(255, 255, 255, 0.25), 0 20px 40px rgba(0, 0, 0, 0.4)',
        'ios-dropdown': '0 0 0 0.5px rgba(255, 255, 255, 0.15), 0 20px 50px rgba(0, 0, 0, 0.5)',
      },
      // 與 globals.css 配合的毛玻璃屬性
      backdropBlur: {
        'ios-glass': '40px',
      },
      backdropSaturate: {
        'ios-glass': '180%',
      },
      // 自定義動畫，讓介面更靈動
      animation: {
        'ios-fade': 'fadeIn 0.2s ease-out',
        'ios-pop': 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        popIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}