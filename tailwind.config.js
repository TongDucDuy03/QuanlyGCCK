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
          canvas: '#F4F6FB',
          surface: '#FFFFFF',
          elevated: '#F8FAFC',
          subtle: '#F1F5F9',
          border: '#E2E8F0',
          borderStrong: '#CBD5E1',
          text: '#0F172A',
          muted: '#64748B',
          accent: '#2563EB',
          run: '#059669',
          warn: '#D97706',
          stop: '#E11D48',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.03)',
        elevated: '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 4px 10px -2px rgba(15, 23, 42, 0.04)',
      },
    },
  },
  plugins: [],
};
