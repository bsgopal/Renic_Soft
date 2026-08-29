/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dce6fb',
          500: '#1a73e8',
          600: '#1557b0',
          700: '#174ea6'
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