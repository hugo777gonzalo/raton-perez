import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/raton-perez/' : '/',
  server: {
    port: Number(process.env.PORT) || 5183,
    strictPort: true,
  },
}))
