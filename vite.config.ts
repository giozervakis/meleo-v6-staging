import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import packageInfo from './package.json' with { type: 'json' }

export default defineConfig({
  plugins: [react()],

  define: {
    '__MELEO_APP_VERSION__':
      JSON.stringify(
        packageInfo.version
      )
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787'
    }
  }
})
