import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir:'./tests/e2e',timeout:30_000,fullyParallel:false,retries:1,reporter:[['list'],['html',{outputFolder:'reports/playwright-html',open:'never'}]],
  use:{baseURL:process.env.E2E_BASE_URL||'http://localhost:5173',trace:'retain-on-failure',screenshot:'only-on-failure',video:'retain-on-failure'},
  projects:[{name:'chromium-desktop',use:{...devices['Desktop Chrome']}},{name:'mobile-chrome',use:{...devices['Pixel 7']}}]
})
