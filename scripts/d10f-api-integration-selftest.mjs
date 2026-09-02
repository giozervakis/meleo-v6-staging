import fs from 'node:fs'

const failures = []

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


const integrationFile =
  'tests/integration/api-runtime.integration.mjs'

const workflowFile =
  '.github/workflows/quality-gate.yml'


check(
  fs.existsSync(
    integrationFile
  ),
  'D10F.3 API runtime integration test exists'
)

const source =
  fs.existsSync(
    integrationFile
  )
    ? fs.readFileSync(
        integrationFile,
        'utf8'
      )
    : ''

const pkg =
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    )
  )

const workflow =
  fs.readFileSync(
    workflowFile,
    'utf8'
  )


check(
  source.includes(
    "spawn("
  ) &&
  source.includes(
    "'server/index.js'"
  ),
  'API harness starts real production server entrypoint'
)

check(
  source.includes(
    'CREATE DATABASE'
  ),
  'API harness creates isolated PostgreSQL database'
)

check(
  source.includes(
    'DROP DATABASE IF EXISTS'
  ),
  'API harness has deterministic database cleanup'
)

check(
  source.includes(
    'pg_terminate_backend'
  ),
  'API cleanup can terminate residual isolated sessions'
)

check(
  source.includes(
    "process.env.NODE_ENV"
  ) &&
  source.includes(
    "'production'"
  ),
  'API harness refuses production mode'
)

check(
  source.includes(
    "'127.0.0.1'"
  ) &&
  source.includes(
    "'localhost'"
  ),
  'API database target has explicit local-host guard'
)

check(
  source.includes(
    "SEED_DEMO:"
  ) &&
  source.includes(
    "'1'"
  ),
  'API runtime uses deterministic relational demo seed'
)

check(
  source.includes(
    '/api/ready'
  ),
  'API runtime waits for real readiness endpoint'
)

check(
  source.includes(
    "'/api/auth/login'"
  ),
  'API runtime verifies authentication contract'
)

check(
  source.includes(
    "'/api/me'"
  ),
  'API runtime verifies session contract'
)

check(
  source.includes(
    "'/api/professionals?limit=20'"
  ),
  'API runtime verifies public professional contract'
)

check(
  source.includes(
    "'/api/bookings'"
  ),
  'API runtime verifies booking HTTP contract'
)

check(
  source.includes(
    'booking API write is persisted in PostgreSQL'
  ),
  'API runtime verifies booking database persistence'
)

check(
  source.includes(
    'unrelated professional cannot mutate booking'
  ),
  'API runtime verifies cross-user authorization'
)

check(
  source.includes(
    'forbidden API mutation leaves database unchanged'
  ),
  'API runtime verifies authorization failure persistence safety'
)

check(
  source.includes(
    'booking state transition persists in PostgreSQL'
  ),
  'API runtime verifies state transition persistence'
)

check(
  source.includes(
    'occupied booking slot is rejected'
  ),
  'API runtime verifies duplicate slot rejection'
)

check(
  source.includes(
    'invalid Origin'
  ),
  'API runtime verifies mutation origin protection'
)

check(
  pkg.scripts?.[
    'test:integration:api'
  ] ===
  'node tests/integration/api-runtime.integration.mjs',
  'D10F.3 runtime package script exists'
)

check(
  pkg.scripts?.[
    'api-integration-check'
  ] ===
  'node scripts/d10f-api-integration-selftest.mjs',
  'D10F.3 structural package script exists'
)

const gate =
  String(
    pkg.scripts?.['ci:gate'] ||
    ''
  )

check(
  gate.includes(
    'npm run postgres-integration-harness-check && npm run api-integration-check'
  ),
  'D10F.3 static proof follows D10F.2 in ci:gate'
)

check(
  workflow.includes(
    'name: Real API integration suite'
  ),
  'GitHub integration job contains D10F.3 runtime step'
)

check(
  workflow.includes(
    'run: npm run test:integration:api'
  ),
  'GitHub integration job executes API runtime suite'
)


const postgresIndex =
  workflow.indexOf(
    'name: Real PostgreSQL integration harness'
  )

const apiIndex =
  workflow.indexOf(
    'name: Real API integration suite'
  )

const e2eIndex =
  workflow.indexOf(
    'name: Critical E2E'
  )

check(
  postgresIndex>=0 &&
  apiIndex>postgresIndex &&
  e2eIndex>apiIndex,
  'API runtime executes after PostgreSQL harness and before Critical E2E'
)


if(failures.length){

  console.error('')
  console.error(
    `MELEO D10F.3 API integration self-test: ${failures.length} failure(s)`
  )

  process.exit(1)
}


console.log('')
console.log(
  'MELEO D10F.3 API integration self-test: OK'
)
