import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'app',
  base: '/app/',
  plugins: [vue(), tailwindcss()],
  build: {
    outDir: '../dist/public/app',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@interfaces/*': '../src/interfaces/*'
    }
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['.ngrok-free.app'],
  }
})
