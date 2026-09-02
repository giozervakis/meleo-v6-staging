import fs from 'node:fs'

function read(path) {
  return fs
    .readFileSync(path, 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
}

function pass(message) {
  console.log(`[PASS] ${message}`)
}

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message)
  }

  pass(message)
}

const workflow =
  read('.github/workflows/quality-gate.yml')

const pkg =
  JSON.parse(
    read('package.json')
  )

const matrixSuites = [
  [
    'postgres-harness',
    'npm run test:integration'
  ],
  [
    'api',
    'npm run test:integration:api'
  ],
  [
    'booking-concurrency',
    'npm run test:integration:booking-concurrency'
  ],
  [
    'billing-stripe',
    'npm run test:integration:billing-stripe'
  ],
  [
    'worker-retry',
    'npm run test:integration:worker-retry'
  ],
  [
    'failure-injection',
    'npm run test:integration:failure-injection'
  ],
  [
    'object-storage-failure',
    'npm run test:integration:object-storage-failure'
  ],
  [
    'mail-failure',
    'npm run test:integration:mail-failure'
  ]
]

requireCondition(
  workflow.includes('runtime-matrix:'),
  'CI has dedicated runtime-matrix job'
)

requireCondition(
  workflow.includes('strategy:') &&
  workflow.includes('fail-fast: false') &&
  workflow.includes('matrix:') &&
  workflow.includes('include:'),
  'runtime matrix preserves independent suite evidence'
)

for (const [suite, command] of matrixSuites) {
  requireCondition(
    workflow.includes(`suite: ${suite}`),
    `runtime matrix contains ${suite}`
  )

  requireCondition(
    workflow.includes(`command: ${command}`),
    `runtime matrix executes ${suite} canonical command`
  )
}

requireCondition(
  workflow.includes('needs_stack: true') &&
  workflow.includes('needs_stack: false'),
  'runtime matrix distinguishes stack and standalone suites'
)

requireCondition(
  workflow.includes(
    "if: ${{ matrix.needs_stack == true }}"
  ),
  'Docker integration stack starts only for suites that need it'
)

requireCondition(
  workflow.includes(
    'set -o pipefail'
  ),
  'matrix runtime preserves command failure through tee'
)

requireCondition(
  workflow.includes(
    'reports/ci-matrix/${{ matrix.suite }}.log'
  ),
  'each matrix suite writes dedicated execution log'
)

requireCondition(
  workflow.includes(
    'name: runtime-${{ matrix.suite }}-${{ github.sha }}'
  ),
  'each matrix suite publishes uniquely named artifact'
)

requireCondition(
  workflow.includes(
    'retention-days: 14'
  ),
  'CI test evidence has bounded artifact retention'
)

requireCondition(
  workflow.includes('browser:'),
  'CI has dedicated browser job'
)

requireCondition(
  workflow.includes(
    'npm run test:e2e:relational'
  ),
  'browser job executes relational Playwright journeys'
)

requireCondition(
  workflow.includes(
    'npx playwright install --with-deps chromium'
  ),
  'browser job installs Chromium dependencies'
)

requireCondition(
  workflow.includes(
    'reports/playwright-relational-html'
  ) &&
  workflow.includes(
    'reports/playwright-relational-results'
  ),
  'browser artifacts preserve Playwright HTML and runtime evidence'
)

requireCondition(
  workflow.includes('system:'),
  'CI has dedicated system/load job'
)

requireCondition(
  workflow.includes(
    'npm run e2e'
  ),
  'system job executes Critical E2E'
)

requireCondition(
  workflow.includes(
    'npm run loadtest'
  ),
  'system job executes baseline load gate'
)

requireCondition(
  workflow.includes(
    'reports/ci-system'
  ),
  'system job captures durable diagnostic logs'
)

requireCondition(
  workflow.includes(
    'docker compose -f docker-compose.dev.yml logs --no-color'
  ),
  'Docker diagnostics are captured on failure'
)

requireCondition(
  workflow.includes(
    'docker compose -f docker-compose.dev.yml down -v'
  ),
  'stack cleanup always removes integration volumes'
)

requireCondition(
  pkg.scripts?.['ci-matrix-check'] ===
    'node scripts/d10f-ci-matrix-selftest.mjs',
  'D10F.9 structural package script exists'
)

const ciGate =
  String(
    pkg.scripts?.['ci:gate'] ||
    ''
  )

const mailIndex =
  ciGate.indexOf(
    'npm run mail-failure-check'
  )

const matrixIndex =
  ciGate.indexOf(
    'npm run ci-matrix-check'
  )

requireCondition(
  mailIndex >= 0 &&
  matrixIndex > mailIndex,
  'D10F.9 static gate follows D10F.8C'
)

console.log('')
console.log(
  'MELEO D10F.9 CI test matrix + artifacts structural self-test: OK'
)