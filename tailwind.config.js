/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#C0392B', foreground: '#FFFFFF' },
        secondary: { DEFAULT: '#E67E22', foreground: '#FFFFFF' },
        accent: { DEFAULT: '#2C3E50', foreground: '#FFFFFF' },
        background: '#F5F0EB',
        surface: '#FFFFFF',
        success: '#27AE60',
        warning: '#F39C12',
        danger: '#E74C3C',
        muted: { DEFAULT: '#F5F0EB', foreground: '#7F8C8D' },
        border: '#E2D9D0',
        brand: {
          red: '#C0392B',
          orange: '#E67E22',
          navy: '#2C3E50',
          cream: '#F5F0EB'
        }
      },
      fontFamily: {
        sans: ['Arial', 'sans-serif']
      }
    }
  },
  plugins: []
}
