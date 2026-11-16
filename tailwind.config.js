/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 900: '#0b1f36', 800: '#0F2A47', 700: '#17395e' },
        teal: { 500: '#1B8A8F', 600: '#157176', 100: '#d9f0f0' },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'] },
    },
  },
  plugins: [],
}
