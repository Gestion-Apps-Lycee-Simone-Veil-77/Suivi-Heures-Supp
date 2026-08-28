/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        // Palette "indigo" plus chaleureuse que le bleu Google par défaut.
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81'
        }
      },
      boxShadow: {
        card: '0 1px 2px rgba(49, 46, 129, 0.04), 0 10px 28px -14px rgba(49, 46, 129, 0.18)'
      }
    }
  },
  plugins: []
};
