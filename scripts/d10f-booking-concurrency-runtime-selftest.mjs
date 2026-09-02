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


const runtime =
  fs.readFileSync(
    'tests/integration/booking-concurrency-runtime.integration.mjs',
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
  runtime.includes(
    "../../server/relational/pool.js"
  ),
  'runtime imports production relational pool'
)

check(
  runtime.includes(
    "../../server/relational/repositories.js"
  ),
  'runtime imports production repositories'
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
    'pg_terminate_backend'
  ),
  'runtime cleanup handles residual DB sessions'
)

check(
  runtime.includes(
    'allowedHosts'
  ) &&
  runtime.includes(
    "'127.0.0.1'"
  ) &&
  runtime.includes(
    "'localhost'"
  ) &&
  runtime.includes(
    "'db'"
  ),
  'runtime has local PostgreSQL safety guard'
)

check(
  runtime.includes(
    'D10F.4 refuses NODE_ENV=production'
  ),
  'runtime refuses production mode'
)

check(
  runtime.includes(
    'Promise.allSettled(['
  ),
  'same-slot booking creation is launched concurrently'
)

check(
  runtime.includes(
    'Bookings.create('
  ),
  'runtime exercises production Bookings.create'
)

check(
  runtime.includes(
    "createFailures[0]?.reason?.code===\n      '23505'"
  ),
  'runtime requires PostgreSQL unique-conflict loser'
)

check(
  runtime.includes(
    'exactly one authoritative active booking survives'
  ),
  'runtime verifies exactly-one booking persistence'
)

check(
  runtime.includes(
    'losing create transaction leaves no orphan durable notification'
  ),
  'runtime verifies create loser has no durable side effect'
)

check(
  runtime.includes(
    'losing create transaction leaves no orphan live event'
  ),
  'runtime verifies create loser has no live-event side effect'
)

check(
  runtime.includes(
    'Promise.all('
  ) &&
  runtime.includes(
    'Bookings.transition('
  ),
  'same-state booking transitions execute concurrently'
)

check(
  runtime.includes(
    "'BOOKING_STATE_CONFLICT'"
  ),
  'runtime requires compare-and-set transition conflict'
)

check(
  runtime.includes(
    'database state equals the winning transition'
  ),
  'runtime verifies authoritative transition winner'
)

check(
  runtime.includes(
    'losing transition leaves no orphan durable notification'
  ),
  'runtime verifies transition loser has no durable side effect'
)

check(
  runtime.includes(
    'losing transition leaves no orphan live event'
  ),
  'runtime verifies transition loser has no live-event side effect'
)

check(
  runtime.includes(
    "createRollbackError?.code===\n      '23503'"
  ),
  'runtime injects real create transaction failure'
)

check(
  runtime.includes(
    'failed create side effect rolls booking INSERT back'
  ),
  'runtime verifies booking-create rollback'
)

check(
  runtime.includes(
    "transitionRollbackError?.code===\n      '23503'"
  ),
  'runtime injects real transition transaction failure'
)

check(
  runtime.includes(
    'failed transition side effect rolls state mutation back'
  ),
  'runtime verifies booking-transition rollback'
)

check(
  runtime.includes(
    'no duplicate active booking slot exists after all races'
  ),
  'runtime verifies final active-slot invariant'
)

check(
  pkg.scripts?.[
    'test:integration:booking-concurrency'
  ]===
  'node tests/integration/booking-concurrency-runtime.integration.mjs',
  'D10F.4 runtime package script exists'
)

check(
  pkg.scripts?.[
    'booking-concurrency-runtime-check'
  ]===
  'node scripts/d10f-booking-concurrency-runtime-selftest.mjs',
  'D10F.4 structural package script exists'
)


const gate =
  String(
    pkg.scripts?.['ci:gate'] ||
    ''
  )


check(
  gate.includes(
    'npm run api-integration-check && npm run booking-concurrency-runtime-check'
  ),
  'D10F.4 static gate follows D10F.3'
)

check(
  workflow.includes(
    'name: Booking concurrency transaction runtime'
  ) ||
  workflow.includes(
    'suite: booking-concurrency'
  ),
  'CI contains D10F.4 runtime coverage'
)

check(
  workflow.includes(
    'run: npm run test:integration:booking-concurrency'
  ) ||
  workflow.includes(
    'command: npm run test:integration:booking-concurrency'
  ),
  'CI executes D10F.4 runtime'
)

const apiIndex =
  Math.max(
    workflow.indexOf(
      'name: Real API integration suite'
    ),
    workflow.indexOf(
      'suite: api'
    )
  )

const concurrencyIndex =
  Math.max(
    workflow.indexOf(
      'name: Booking concurrency transaction runtime'
    ),
    workflow.indexOf(
      'suite: booking-concurrency'
    )
  )

check(
  apiIndex >= 0 &&
  concurrencyIndex > apiIndex,
  'CI definition preserves API -> booking concurrency ordering'
)


if(failures.length){

  console.error('')
  console.error(
    `MELEO D10F.4 structural self-test: ${failures.length} failure(s)`
  )

  process.exit(1)
}


console.log('')
console.log(
  'MELEO D10F.4 booking concurrency structural self-test: OK'
)