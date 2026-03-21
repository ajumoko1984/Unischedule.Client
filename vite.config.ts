import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // target: 'localhost:5000',
        target: 'https://unischedule-server.onrender.com',
        changeOrigin: true,
      },
    },
  },
})
