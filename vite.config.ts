import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return undefined;
          if (id.includes('/@supabase/')) return 'supabase';
          if (id.includes('/@vitejs/') || id.includes('/vite/')) return 'build-tools';
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
          return 'vendor';
        },
      },
    },
  },
  server: {
    proxy: {
      // Wife route FIRST - prevents /api/investor prefix from matching /api/investor-wife.
      '/api/investor-wife': {
        target: 'https://script.google.com',
        changeOrigin: true,
        secure: true,
        followRedirects: true,
        rewrite: () =>
          '/macros/s/AKfycbwPvwu-EMXb9hGCZeRFhr9O8Vvz5-2y1sqn4V4OMsgqNkTs2t3U6zGDw7SVgdPVmrwg/exec',
      },
      '/api/investor': {
        target: 'https://script.google.com',
        changeOrigin: true,
        secure: true,
        followRedirects: true,
        rewrite: () =>
          '/macros/s/AKfycbwBtbI9LmbZGyr4gi35oXym56i1py5J_oy0shp_gDotJBmsRnG2UmVVvmPFBigoE3uLeA/exec',
      },
      '/api/fear-greed': {
        target: 'https://api.alternative.me',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/fng/?limit=30',
      },
    },
  }
})
