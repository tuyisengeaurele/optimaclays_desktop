/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#C0392B', foreground: '#FFFFFF' },
        secondary: { DEFAULT: '#E67E22', foreground: '#FFFFFF' },
        // background/surface/accent/muted/border read from CSS variables (see
        // index.css) so every page gets dark mode by swapping the variables'
        // values under a .dark class, with no per-page class changes needed.
        // The <alpha-value> placeholder is required for bg-x/50-style opacity
        // modifiers to keep working on a variable-backed color.
        accent: { DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)', foreground: '#FFFFFF' },
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        success: '#27AE60',
        warning: '#F39C12',
        danger: '#E74C3C',
        muted: {
          DEFAULT: 'rgb(var(--color-background) / <alpha-value>)',
          foreground: 'rgb(var(--color-muted-foreground) / <alpha-value>)'
        },
        border: 'rgb(var(--color-border) / <alpha-value>)',
        // Fixed brand chrome colors (sidebar, login header, toast) - these
        // deliberately do NOT invert in dark mode, unlike `accent` above.
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
