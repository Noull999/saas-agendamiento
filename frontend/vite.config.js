import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // En desarrollo: proxy al backend local
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  build: {
    // En producción el frontend se sirve desde el mismo dominio que la API,
    // así que las llamadas a /api/* van al mismo servidor Express
    outDir: 'dist',
  }
})
