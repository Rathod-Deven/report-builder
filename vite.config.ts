import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' lets the built site work on GitHub Pages (any repo name) and on Vercel/Netlify.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      // Browser build of ExcelJS (the default build needs Node polyfills).
      exceljs: 'exceljs/dist/exceljs.min.js',
    },
  },
})
