/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/client/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      colors: {
        industrial: {
          canvas: '#090D16',
          surface: '#111827',
          elevated: '#182235',
          border: '#23304D',
          muted: '#94A3B8',
          accent: '#38BDF8',
          run: '#10B981',
          warn: '#F59E0B',
          stop: '#EF4444',
        },
      },
    },
  },
  plugins: [],
};
