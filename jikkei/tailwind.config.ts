import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'jikkei-pink': {
          50: '#fff0f5',
          100: '#ffd6e7',
          300: '#ff85b3',
          500: '#e91e8c',
          700: '#b5006b',
          900: '#6b003e',
        },
        'jikkei-black': {
          900: '#0a0a0f',
          800: '#12121a',
          700: '#1a1a26',
          600: '#242433',
        },
        'jikkei-accent': '#ff2d78',
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
      },
      keyframes: {
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'persona-slide-in': {
          '0%': {
            opacity: '0',
            transform: 'translateX(-100%)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
      },
      animation: {
        flicker: 'flicker 200ms ease-in-out',
        scanline: 'scanline 8s linear infinite',
        'persona-slide-in': 'persona-slide-in 0.6s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config
