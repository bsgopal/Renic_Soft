/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          dark: '#0f172a'
        },
        ink: {
          DEFAULT: '#202124',
          soft: '#5f6368',
          faint: '#80868b'
        }
      },
      fontFamily: {
        sans: ['"Google Sans"', '"Roboto"', '"Segoe UI"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)',
        cardhover: '0 1px 3px 0 rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15)'
      }
    }
  },
  plugins: []
};