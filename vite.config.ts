import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import packageInfo from './package.json' with { type: 'json' }

export default defineConfig({
  plugins: [react()],

  define: {
    '__MELEO_APP_VERSION__':
      JSON.stringify(
        packageInfo.version
      ),
    '__MELEO_BUILD_SHA__':
      JSON.stringify(
        process.env.RENDER_GIT_COMMIT ||
        process.env.GIT_COMMIT ||
        'local'
      )
  },
  server: {
    port: 5173,
    proxy: {
      '/api':
        process.env.VITE_API_PROXY_TARGET ||
        'http://localhost:8787'
    }
  }
})
