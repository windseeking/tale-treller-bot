import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'app',
  base: '/app/',
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@shared/i18n': path.resolve('src/shared/i18n/index.ts')
    }
  },
  build: {
    outDir: '../dist/public/app',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['.ngrok-free.app'],
  }
})
