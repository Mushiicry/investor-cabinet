import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/investor': {
        target: 'https://script.google.com',
        changeOrigin: true,
        secure: true,
        followRedirects: true,
        rewrite: () =>
          '/macros/s/AKfycbwBtbI9LmbZGyr4gi35oXym56i1py5J_oy0shp_gDotJBmsRnG2UmVVvmPFBigoE3uLeA/exec',
      },
      '/api/investor-wife': {
        target: 'https://script.google.com',
        changeOrigin: true,
        secure: true,
        followRedirects: true,
        // REPLACE_WIFE_SCRIPT_ID with the actual ID after deploying wife's Apps Script
        rewrite: () =>
          '/macros/s/AKfycby_drIkmHUxtBWSSzpnZMxTeMq0qVZX8h1Kvjg5z2knRNxhPLbiXCB6_lmZsQpNQz8/exec',
      },
      '/api/fear-greed': {
        target: 'https://api.alternative.me',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/fng/?limit=30',
      },
    },
  },
})
