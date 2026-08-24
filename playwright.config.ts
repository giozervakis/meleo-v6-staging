import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',

  timeout: 30_000,

  fullyParallel: false,

  retries: 1,

  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: 'reports/playwright-html',
        open: 'never'
      }
    ]
  ],

  use: {
    baseURL:
      process.env.E2E_BASE_URL ||
      'http://localhost:5173',

    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  webServer: [
    {
  command: 'npm run dev:api',
  url: 'http://localhost:8787/api/health',
  reuseExistingServer: true,
  timeout: 120_000,
  env: {
    ...process.env,
    NODE_ENV: 'development',

    /*
     * Deterministic local E2E admin credentials.
     * Σε production δεν χρησιμοποιείται το Playwright config.
     */
    ADMIN_PASSWORD:
      process.env.E2E_ADMIN_PASSWORD || 'admin123'
  }
},
    {
      command: 'npm run dev:web -- --port 5173',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000
    }
  ],

  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome']
      }
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7']
      }
    }
  ]
})