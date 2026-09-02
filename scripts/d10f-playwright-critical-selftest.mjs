import fs from 'node:fs'


const failures=[]


function check(
  condition,
  message
){
  if(condition){

    console.log(
      '[PASS]',
      message
    )

  }
  else{

    console.error(
      '[FAIL]',
      message
    )

    failures.push(
      message
    )
  }
}


const config =
  fs.readFileSync(
    'playwright.relational.config.ts',
    'utf8'
  )


const runtime =
  fs.readFileSync(
    'scripts/d10f-playwright-relational-runtime.mjs',
    'utf8'
  )


const vite =
  fs.readFileSync(
    'vite.config.ts',
    'utf8'
  )


const booking =
  fs.readFileSync(
    'tests/e2e/booking.spec.ts',
    'utf8'
  )


const subscription =
  fs.readFileSync(
    'tests/e2e/subscription.spec.ts',
    'utf8'
  )


const workflow =
  fs.readFileSync(
    '.github/workflows/quality-gate.yml',
    'utf8'
  )


const pkg =
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    )
  )


check(
  config.includes(
    "process.env.DATABASE_URL"
  ),
  'relational Playwright config requires DATABASE_URL'
)


check(
  config.includes(
    "command:\n        'node server/index.js'"
  ),
  'relational Playwright starts real production API entrypoint'
)


check(
  config.includes(
    "SEED_DEMO:"
  ) &&
  config.includes(
    "'1'"
  ),
  'relational Playwright enables deterministic demo seed'
)


check(
  config.includes(
    "DEMO_AUTH:"
  ) &&
  config.includes(
    "DEMO_CHECKOUT:"
  ),
  'relational Playwright enables deterministic auth and checkout'
)


check(
  config.includes(
    "reuseExistingServer:\n        false"
  ),
  'relational Playwright refuses accidental server reuse'
)


check(
  config.includes(
    "Desktop Chrome"
  ),
  'critical journeys cover desktop Chromium'
)


check(
  config.includes(
    "Pixel 7"
  ),
  'critical journeys cover mobile Chrome'
)


check(
  config.includes(
    "trace:\n      'retain-on-failure'"
  ),
  'failure traces are retained'
)


check(
  config.includes(
    "screenshot:\n      'only-on-failure'"
  ),
  'failure screenshots are retained'
)


check(
  config.includes(
    "video:\n      'retain-on-failure'"
  ),
  'failure videos are retained'
)


check(
  vite.includes(
    'process.env.VITE_API_PROXY_TARGET'
  ),
  'Vite supports isolated relational API proxy target'
)


check(
  vite.includes(
    "'http://localhost:8787'"
  ),
  'normal local Vite API proxy fallback is preserved'
)


check(
  runtime.includes(
    'CREATE DATABASE'
  ),
  'Playwright harness creates isolated PostgreSQL database'
)


check(
  runtime.includes(
    'DROP DATABASE IF EXISTS'
  ),
  'Playwright harness has deterministic database cleanup'
)


check(
  runtime.includes(
    'pg_terminate_backend'
  ),
  'Playwright cleanup terminates residual isolated sessions'
)


check(
  runtime.includes(
    'D10F.7 refuses NODE_ENV=production'
  ),
  'Playwright harness refuses production mode'
)


check(
  runtime.includes(
    'allowedHosts'
  ) &&
  runtime.includes(
    '127.0.0.1'
  ),
  'Playwright harness has explicit local PostgreSQL safety guard'
)


check(
  runtime.includes(
    '.randomBytes(32)'
  ),
  'Playwright harness uses ephemeral sensitive-data key'
)


check(
  runtime.includes(
    'reservePort'
  ),
  'Playwright harness reserves isolated API/web ports'
)


check(
  runtime.includes(
    'tests/e2e/booking.spec.ts'
  ),
  'Playwright runtime executes booking journey'
)


check(
  runtime.includes(
    'tests/e2e/subscription.spec.ts'
  ),
  'Playwright runtime executes professional billing journey'
)


check(
  booking.includes(
    "POST /api/bookings"
  ) &&
  booking.includes(
    "Η κράτησή σου είναι σε αναμονή"
  ),
  'existing booking spec proves real booking POST and success UI'
)


check(
  booking.includes(
    "name: /^\\d{2}:\\d{2}$/"
  ) &&
  booking.includes(
    'Booking UI must expose at least one authoritative availability slot'
  ) &&
  booking.includes(
    "'aria-pressed'"
  ),
  'booking journey uses current authoritative slot-button UI'
)


const gitignore =
  fs.readFileSync(
    '.gitignore',
    'utf8'
  )


check(
  gitignore.includes(
    'reports/playwright-relational-html/'
  ) &&
  gitignore.includes(
    'reports/playwright-relational-results/'
  ),
  'generated relational Playwright artifacts are gitignored'
)


check(
  subscription.includes(
    '/api/professional/subscription'
  ) &&
  subscription.includes(
    '/checkout'
  ),
  'existing subscription spec exercises real billing API journey'
)


check(
  runtime.includes(
    'Playwright booking journey persisted real PostgreSQL booking'
  ),
  'post-browser PostgreSQL booking evidence is required'
)


check(
  runtime.includes(
    'browser API ran production relational migrations'
  ),
  'post-browser migration evidence is required'
)


check(
  runtime.includes(
    'durable relational notification evidence'
  ),
  'post-browser durable notification evidence is required'
)


check(
  pkg.scripts?.[
    'test:e2e:relational'
  ] ===
  'node scripts/d10f-playwright-relational-runtime.mjs',
  'D10F.7 relational browser runtime package script exists'
)


check(
  pkg.scripts?.[
    'playwright-critical-check'
  ] ===
  'node scripts/d10f-playwright-critical-selftest.mjs',
  'D10F.7 structural package script exists'
)


const gate =
  String(
    pkg.scripts?.['ci:gate'] ||
    ''
  )


check(
  gate.includes(
    'npm run worker-retry-runtime-check && npm run playwright-critical-check'
  ),
  'D10F.7 structural gate follows D10F.6'
)


check(
  workflow.includes(
    'name: Install Playwright Chromium'
  ),
  'CI installs Playwright Chromium'
)


check(
  workflow.includes(
    'npx playwright install --with-deps chromium'
  ),
  'CI installs Chromium system dependencies'
)


check(
  workflow.includes(
    'name: Relational Playwright critical journeys'
  ),
  'CI contains D10F.7 runtime step'
)


check(
  workflow.includes(
    'run: npm run test:e2e:relational'
  ),
  'CI executes relational Playwright runtime'
)


check(
  workflow.includes(
    'name: Upload relational Playwright artifacts'
  ),
  'CI uploads relational Playwright artifacts'
)


const legacyWorkerIndex =
  workflow.indexOf(
    'name: Worker retry background-job runtime'
  )

const matrixWorkerIndex =
  workflow.indexOf(
    'suite: worker-retry'
  )

const installIndex =
  workflow.indexOf(
    'name: Install Playwright Chromium'
  )

const browserIndex =
  workflow.indexOf(
    'name: Relational Playwright critical journeys'
  )

const criticalIndex =
  workflow.indexOf(
    'name: Critical E2E'
  )

check(
  (
    legacyWorkerIndex >= 0 &&
    installIndex > legacyWorkerIndex &&
    browserIndex > installIndex &&
    criticalIndex > browserIndex
  ) ||
  (
    matrixWorkerIndex >= 0 &&
    installIndex > matrixWorkerIndex &&
    browserIndex > installIndex &&
    criticalIndex > browserIndex
  ),
  'CI architecture preserves worker coverage -> browser -> Critical E2E'
)


if(
  failures.length
){

  console.error('')
  console.error(
    `MELEO D10F.7 structural self-test: ${failures.length} failure(s)`
  )

  process.exit(
    1
  )
}


console.log('')
console.log(
  'MELEO D10F.7 Playwright critical journeys structural self-test: OK'
)