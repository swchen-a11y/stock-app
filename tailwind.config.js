/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          black: '#000000',
          darkGray: '#1C1C1E',
          secondaryDark: '#2C2C2E',
          blue: '#0A84FF',
          green: '#34C759',
          red: '#FF453A',
          gray: '#8E8E93',
          lightGray: '#D1D1D6',
          white: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: [
          'SF Pro Display',
          'SF Pro Text',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        'apple-xl': '12px',
        'apple-2xl': '16px',
        'apple-3xl': '20px',
      },
    },
  },
  plugins: [],
}
