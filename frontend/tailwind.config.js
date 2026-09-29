/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#e03e2d', dark: '#c53526', light: '#fef2f2' },
      },
    },
  },
  plugins: [],
};