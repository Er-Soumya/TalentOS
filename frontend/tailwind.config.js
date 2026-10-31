/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"DM Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#EFF5FF', 100: '#DEEAFF', 200: '#BCD3FB', 500: '#3B7BF2', 600: '#2F6BE0', 700: '#2557B8' },
        ink: '#1E293B',
        muted: '#64748B',
        line: '#E5E9F0',
        surface: '#F6F8FB',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.05)',
        pop: '0 16px 40px rgba(16,24,40,.14)',
      },
    },
  },
  plugins: [],
}
