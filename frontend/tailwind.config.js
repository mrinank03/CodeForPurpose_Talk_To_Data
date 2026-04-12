/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        natwest: {
          primary: '#42145F',
          dark: '#2D0E42',
          medium: '#5C2D8A',
          light: '#7B4FAF',
          teal: '#00857A',
          tealLight: '#00A89A',
          bg: '#0F0A1A',
          surface: '#1A1025',
          border: '#2D1F45',
          textPrimary: '#F0EBF7',
          textSecondary: '#A08CC0',
          success: '#22C55E',
          warning: '#F59E0B',
          danger: '#EF4444',
        }
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        slideUp: 'slideUp 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
}
