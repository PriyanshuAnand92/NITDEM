import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor_react: ['react', 'react-dom'],
          vendor_ui: ['recharts', 'framer-motion'],
          vendor_map: ['leaflet', 'react-leaflet'],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
})

