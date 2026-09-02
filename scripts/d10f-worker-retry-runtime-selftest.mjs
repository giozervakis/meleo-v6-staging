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


const service =
  fs.readFileSync(
    'server/services/job-runtime.service.js',
    'utf8'
  )

const worker =
  fs.readFileSync(
    'server/worker.js',
    'utf8'
  )

const runtime =
  fs.readFileSync(
    'tests/integration/worker-retry-runtime.integration.mjs',
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
  service.includes(
    'export function createJobRuntime'
  ),
  'canonical shared job runtime service exists'
)

check(
  service.includes(
    'FOR UPDATE SKIP LOCKED'
  ),
  'canonical runtime uses PostgreSQL SKIP LOCKED claiming'
)

check(
  service.includes(
    'attempts=attempts+1'
  ),
  'canonical runtime increments attempts atomically'
)

check(
  service.includes(
    "status='completed'"
  ),
  'canonical runtime owns completed transition'
)

check(
  service.includes(
    'export function retryDelaySeconds'
  ) &&
  service.includes(
    'Math.min('
  ) &&
  service.includes(
    '3600'
  ),
  'canonical runtime owns bounded exponential backoff'
)

check(
  service.includes(
    "terminal\n          ? 'failed'\n          : 'pending'"
  ),
  'canonical runtime owns retry/dead-letter status decision'
)

check(
  service.includes(
    "interval '10 minutes'"
  ) &&
  service.includes(
    '[stale lock recovered]'
  ),
  'canonical runtime owns stale-lock recovery'
)

check(
  worker.includes(
    "import { createJobRuntime } from './services/job-runtime.service.js'"
  ),
  'production worker imports canonical runtime'
)

check(
  worker.includes(
    'const jobRuntime='
  ) &&
  worker.includes(
    'createJobRuntime({'
  ),
  'production worker instantiates canonical runtime'
)

check(
  worker.includes(
    'await jobRuntime.recoverStale()'
  ),
  'production worker delegates stale recovery'
)

check(
  worker.includes(
    'await jobRuntime.claim()'
  ),
  'production worker delegates claims'
)

check(
  worker.includes(
    'await jobRuntime.run('
  ),
  'production worker delegates execution lifecycle'
)

check(
  !worker.includes(
    'async function claim(){'
  ) &&
  !worker.includes(
    'async function recoverStale(){'
  ),
  'duplicate private worker runtime implementations removed'
)

check(
  runtime.includes(
    '../../server/services/job-runtime.service.js'
  ),
  'runtime test imports canonical production job runtime'
)

check(
  runtime.includes(
    '../../server/jobs.js'
  ),
  'runtime test exercises production enqueue and queueStats'
)

check(
  runtime.includes(
    'await migrate()'
  ),
  'runtime executes production migrations'
)

check(
  runtime.includes(
    'CREATE DATABASE'
  ) &&
  runtime.includes(
    'DROP DATABASE IF EXISTS'
  ),
  'runtime owns isolated PostgreSQL database lifecycle'
)

check(
  runtime.includes(
    'Promise.all(['
  ) &&
  runtime.includes(
    'workerA.claim()'
  ) &&
  runtime.includes(
    'workerB.claim()'
  ),
  'runtime launches concurrent worker claims'
)

check(
  runtime.includes(
    'exactly one claim winner'
  ),
  'runtime verifies exactly-one claim semantics'
)

check(
  runtime.includes(
    'first failure schedules 15-second retry'
  ) &&
  runtime.includes(
    '30-second retry'
  ),
  'runtime verifies exponential backoff'
)

check(
  runtime.includes(
    'max-attempt failure becomes terminal dead-letter'
  ),
  'runtime verifies terminal dead-letter behavior'
)

check(
  runtime.includes(
    'stale recovery touches exactly expired processing lock'
  ),
  'runtime verifies stale lock recovery'
)

check(
  runtime.includes(
    'future run_at job is not claimed'
  ),
  'runtime verifies future jobs are excluded'
)

check(
  runtime.includes(
    'highest priority is claimed first'
  ),
  'runtime verifies priority ordering'
)

check(
  runtime.includes(
    'account deletion retry does not recursively enqueue another recovery job'
  ),
  'runtime verifies account deletion retry non-recursion'
)

check(
  runtime.includes(
    '.randomBytes(32)'
  ),
  'runtime uses ephemeral sensitive-data key'
)

check(
  pkg.scripts?.[
    'test:integration:worker-retry'
  ]===
  'node tests/integration/worker-retry-runtime.integration.mjs',
  'D10F.6 runtime package script exists'
)

check(
  pkg.scripts?.[
    'worker-retry-runtime-check'
  ]===
  'node scripts/d10f-worker-retry-runtime-selftest.mjs',
  'D10F.6 structural package script exists'
)

const gate =
  String(
    pkg.scripts?.['ci:gate']||
    ''
  )

check(
  gate.includes(
    'npm run billing-stripe-contract-check && npm run worker-retry-runtime-check'
  ),
  'D10F.6 static gate follows D10F.5'
)

check(
  workflow.includes(
    'name: Worker retry background-job runtime'
  ),
  'CI contains D10F.6 runtime step'
)

check(
  workflow.includes(
    'run: npm run test:integration:worker-retry'
  ),
  'CI executes D10F.6 runtime'
)

const billingIndex =
  workflow.indexOf(
    'name: Billing Stripe contract runtime'
  )

const workerIndex =
  workflow.indexOf(
    'name: Worker retry background-job runtime'
  )

const e2eIndex =
  workflow.indexOf(
    'name: Critical E2E'
  )

check(
  billingIndex>=0 &&
  workerIndex>billingIndex &&
  e2eIndex>workerIndex,
  'CI order is billing -> worker runtime -> Critical E2E'
)


if(failures.length){
  console.error('')
  console.error(
    `MELEO D10F.6 structural self-test: ${failures.length} failure(s)`
  )
  process.exit(1)
}

console.log('')
console.log(
  'MELEO D10F.6 worker / retry runtime structural self-test: OK'
)