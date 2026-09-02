import {
  defineConfig,
  devices
} from '@playwright/test'


const apiPort =
  Number(
    process.env.MELEO_E2E_API_PORT ||
    18787
  )


const webPort =
  Number(
    process.env.MELEO_E2E_WEB_PORT ||
    15173
  )


const apiUrl =
  process.env.E2E_API_URL ||
  `http://127.0.0.1:${apiPort}`


const webUrl =
  process.env.E2E_BASE_URL ||
  `http://127.0.0.1:${webPort}`


if(
  !process.env.DATABASE_URL
){
  throw new Error(
    'playwright.relational.config.ts requires DATABASE_URL'
  )
}


export default defineConfig({

  testDir:
    './tests/e2e',

  timeout:
    45_000,

  expect: {
    timeout:
      10_000
  },

  fullyParallel:
    false,

  workers:
    1,

  retries:
    process.env.CI
      ? 1
      : 0,

  reporter: [
    [
      'list'
    ],
    [
      'html',
      {
        outputFolder:
          'reports/playwright-relational-html',

        open:
          'never'
      }
    ]
  ],

  outputDir:
    'reports/playwright-relational-results',

  use: {

    baseURL:
      webUrl,

    trace:
      'retain-on-failure',

    screenshot:
      'only-on-failure',

    video:
      'retain-on-failure'
  },


  /*
   * D10F.7:
   *
   * Start the actual relational API entrypoint against the isolated
   * PostgreSQL database created by the runtime harness.
   *
   * The Vite frontend proxies /api to this exact API instance.
   */
  webServer: [

    {
      command:
        'node server/index.js',

      url:
        `${apiUrl}/api/health`,

      reuseExistingServer:
        false,

      timeout:
        120_000,

      env: {
        ...process.env,

        NODE_ENV:
          'development',

        PORT:
          String(apiPort),

        APP_URL:
          webUrl,

        DATABASE_URL:
          process.env.DATABASE_URL,

        DATABASE_SSL:
          '0',

        DATABASE_POOL_MAX:
          '8',

        REDIS_URL:
          '',

        REDIS_REQUIRED:
          '0',

        SEED_DEMO:
          '1',

        E2E_MODE:
          '1',

        DEMO_AUTH:
          '1',

        DEMO_CHECKOUT:
          '1',

        STORAGE_DRIVER:
          'local',

        GEOCODING_PROVIDER:
          'fixture'
      }
    },


    {
      command:
        `npm run dev:web -- --host 127.0.0.1 --port ${webPort}`,

      url:
        webUrl,

      reuseExistingServer:
        false,

      timeout:
        120_000,

      env: {
        ...process.env,

        VITE_API_PROXY_TARGET:
          apiUrl
      }
    }
  ],


  /*
   * Both critical browser surfaces are executed against the same
   * deterministic relational backend.
   */
  projects: [

    {
      name:
        'chromium-desktop',

      use: {
        ...devices[
          'Desktop Chrome'
        ]
      }
    },


    {
      name:
        'mobile-chrome',

      use: {
        ...devices[
          'Pixel 7'
        ]
      }
    }
  ]
})