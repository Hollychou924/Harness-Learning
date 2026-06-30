/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1d1d1f',
          soft: '#3a3a3c'
        },
        glass: {
          DEFAULT: 'rgba(255,255,255,0.6)',
          dark: 'rgba(28,28,30,0.55)'
        }
      },
      backdropBlur: {
        xs: '2px'
      }
    }
  },
  plugins: []
}
