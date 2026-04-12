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
        // 統一 iOS 官方標準色碼
        'ios-red': '#FF453A',    // System Red (漲)
        'ios-green': '#30D158',  // System Green (跌)
        'ios-blue': '#007AFF',   // System Blue (交互)
        'ios-gray': '#8E8E93',   // System Gray (次要文字)
        'ios-flat': '#8E8E93',   // 平盤色碼
      },
      borderRadius: {
        // 統一圓角規範
        'ios-pill': '8px',     // 漲跌幅膠囊
        'ios-sm': '12px',      // 小型按鈕
        'ios-md': '16px',      // 卡片/輸入框
        'ios-lg': '24px',      // 下拉選單 (Dropdown)
        'ios-xl': '28px',      // 標準彈窗 (Modal)
        'ios-2xl': '32px',     // 大型容器
      },
      boxShadow: {
        // 統一液態玻璃光影參數
        'ios-glass': '0 0 0 0.5px rgba(255, 255, 255, 0.12), inset 0 0 0 0.5px rgba(255, 255, 255, 0.05)',
        'ios-glass-heavy': '0 0 0 0.5px rgba(255, 255, 255, 0.15), inset 0 1px 1.5px rgba(255, 255, 255, 0.25), 0 20px 40px rgba(0, 0, 0, 0.4)',
      },
      backdropBlur: {
        'ios-glass': '30px',
        'ios-heavy': '40px',
      },
      animation: {
        'ios-fade': 'fadeIn 0.2s ease-out',
        'ios-pop': 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        popIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}