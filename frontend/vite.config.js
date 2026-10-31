import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev the SPA calls same-origin `/api` (like the packaged prod build) and
// Vite forwards it to the backend, so dev never depends on CORS. start-dev.ps1
// sets VITE_API_PROXY_TARGET when it had to pick a non-default backend port.
const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: apiTarget },
    },
  },
  test: {
    environment: 'jsdom',
  },
})
