import fs from 'node:fs'

const read=path=>
  fs.readFileSync(path,'utf8')
    .replace(/^\uFEFF/,'')
    .replace(/\r\n/g,'\n')

const integration=
  read(
    'tests/integration/postgres-runtime.integration.mjs'
  )

const workflow=
  read(
    '.github/workflows/quality-gate.yml'
  )

const pkg=
  JSON.parse(
    read(
      'package.json'
    )
  )

let failed=false

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
    failed=true
    console.error(
      '[FAIL]',
      message
    )
  }
}


check(
  integration.includes(
    "await import(\n      '../../server/relational/pool.js'"
  ),
  'integration harness imports production relational pool'
)

check(
  integration.includes(
    'await migrate()'
  ),
  'integration harness executes production migrations'
)

check(
  integration.includes(
    'schema_migrations'
  ),
  'migration ledger is runtime verified'
)

check(
  integration.includes(
    'production migration runner is runtime-idempotent'
  ),
  'migration idempotency is verified'
)

check(
  integration.includes(
    'CREATE DATABASE'
  ),
  'integration harness creates isolated PostgreSQL database'
)

check(
  integration.includes(
    'DROP DATABASE IF EXISTS'
  ),
  'isolated PostgreSQL database has deterministic cleanup'
)

check(
  integration.includes(
    'pg_terminate_backend'
  ),
  'cleanup can terminate residual isolated DB sessions'
)

check(
  integration.includes(
    "url.pathname=\n    '/postgres'"
  ),
  'database lifecycle uses PostgreSQL maintenance database'
)

check(
  integration.includes(
    'process.env.DATABASE_URL=\n    isolatedDatabaseUrl()'
  ),
  'production pool is redirected to isolated test database before import'
)

check(
  integration.includes(
    'transaction COMMIT persists writes'
  ),
  'real COMMIT semantics are verified'
)

check(
  integration.includes(
    'transaction ROLLBACK removes failed write'
  ),
  'real ROLLBACK semantics are verified'
)

check(
  integration.includes(
    'multi-write failure leaves no partial transaction state'
  ),
  'multi-write atomic rollback is verified'
)

check(
  integration.includes(
    'pg_backend_pid()'
  ),
  'real concurrent PostgreSQL sessions are verified'
)

check(
  integration.includes(
    'core production tables exist after real migrations'
  ),
  'fresh production schema is runtime verified'
)

check(
  integration.includes(
    "allowedHosts"
  ) &&
  integration.includes(
    "'127.0.0.1'"
  ) &&
  integration.includes(
    "'localhost'"
  ) &&
  integration.includes(
    "'db'"
  ),
  'integration DB target has explicit local-host guard'
)

check(
  integration.includes(
    "process.env.NODE_ENV===\n  'production'"
  ),
  'integration harness refuses production mode'
)

check(
  pkg.scripts?.[
    'test:integration:postgres'
  ]===
  'node tests/integration/postgres-runtime.integration.mjs',
  'PostgreSQL integration package script exists'
)

check(
  pkg.scripts?.[
    'test:integration'
  ]===
  'npm run test:integration:postgres',
  'integration suite package alias exists'
)

check(
  pkg.scripts?.[
    'postgres-integration-harness-check'
  ]===
  'node scripts/d10f-postgres-integration-harness-selftest.mjs',
  'D10F.2 structural selftest package script exists'
)

const ciGate =
  String(
    pkg.scripts?.['ci:gate'] ||
    ''
  )

const d10eClosure =
  ciGate.indexOf(
    'npm run account-deletion-recovery-check'
  )

const d10f2Gate =
  ciGate.indexOf(
    'npm run postgres-integration-harness-check'
  )

check(
  d10eClosure>=0 &&
  d10f2Gate>d10eClosure,
  'D10F.2 static proof follows D10E closure in ci:gate'
)

check(
  workflow.includes(
    'name: Real PostgreSQL integration harness'
  ) ||
  workflow.includes(
    'suite: postgres-harness'
  ),
  'GitHub CI contains PostgreSQL runtime coverage'
)

check(
  workflow.includes(
    'DATABASE_URL: postgres://meleo:meleo_dev@127.0.0.1:54329/meleo'
  ),
  'GitHub runtime bootstrap targets deterministic local PostgreSQL'
)

check(
  workflow.includes(
    'run: npm run test:integration'
  ) ||
  workflow.includes(
    'command: npm run test:integration'
  ),
  'GitHub CI executes PostgreSQL runtime suite'
)

const legacyRuntime =
  workflow.indexOf(
    'name: Real PostgreSQL integration harness'
  )

const matrixRuntime =
  workflow.indexOf(
    'suite: postgres-harness'
  )

const browserJob =
  workflow.indexOf(
    'browser:'
  )

check(
  (
    legacyRuntime >= 0
  ) ||
  (
    matrixRuntime >= 0 &&
    browserJob > matrixRuntime
  ),
  'PostgreSQL runtime is preserved before browser CI phase'
)


if(failed){
  process.exit(1)
}

console.log('')
console.log(
  'MELEO D10F.2 PostgreSQL integration harness self-test: OK'
)
