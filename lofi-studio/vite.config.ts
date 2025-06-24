import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    // Configure the dev server to handle client-side routing
    // This ensures that all routes serve index.html in development
    middlewareMode: false,
  },
  preview: {
    // Also configure the preview server for production builds
    port: 4173,
  },
  appType: 'spa' // Single Page Application mode
})