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

    return
  }


  console.error(
    '[FAIL]',
    message
  )

  failures.push(
    message
  )
}


const runtime =
  fs.readFileSync(
    'tests/integration/failure-injection-runtime.integration.mjs',
    'utf8'
  )


const pool =
  fs.readFileSync(
    'server/relational/pool.js',
    'utf8'
  )


const redis =
  fs.readFileSync(
    'server/redis.js',
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
    'D10F.8A refuses NODE_ENV=production'
  ),
  'failure-injection runtime refuses production mode'
)


check(
  runtime.includes(
    'allowedHosts'
  ) &&
  runtime.includes(
    "'127.0.0.1'"
  ),
  'failure-injection runtime has local PostgreSQL host guard'
)


check(
  runtime.includes(
    'CREATE DATABASE'
  ) &&
  runtime.includes(
    'DROP DATABASE IF EXISTS'
  ),
  'failure-injection runtime owns isolated PostgreSQL database lifecycle'
)


check(
  runtime.includes(
    "constraintError?.code ===\n      '23505'"
  ),
  'runtime injects real PostgreSQL unique-constraint failure'
)


check(
  runtime.includes(
    "timeoutError?.code ===\n      '57014'"
  ),
  'runtime injects real PostgreSQL statement timeout'
)


check(
  runtime.includes(
    "'42P01'"
  ),
  'runtime injects standalone PostgreSQL query failure'
)


check(
  runtime.includes(
    'database error rolls back earlier write in same transaction'
  ),
  'runtime verifies constraint failure transaction rollback'
)


check(
  runtime.includes(
    'statement timeout rolls back earlier transaction write'
  ),
  'runtime verifies timeout transaction rollback'
)


check(
  runtime.includes(
    'production PostgreSQL pool recovers after statement timeout'
  ),
  'runtime verifies PostgreSQL pool recovery'
)


check(
  pool.includes(
    "await client.query('ROLLBACK')"
  ) &&
  pool.includes(
    'client.release()'
  ),
  'runtime targets canonical production transaction rollback implementation'
)


check(
  redis.includes(
    'timer = setTimeout(() => {'
  ) &&
  redis.includes(
    'item.reject('
  ) &&
  redis.includes(
    "'Redis command timeout'"
  ),
  'production Redis client has explicit command timeout'
)


check(
  redis.includes(
    'targetSocket.destroy('
  ) &&
  redis.includes(
    "'Redis command timeout'"
  ) &&
  redis.includes(
    'state.pending.splice('
  ),
  'production Redis timeout resets owning connection'
)

check(
  redis.includes(
    'const socketStates = new WeakMap()'
  ) &&
  redis.includes(
    'function stateFor(targetSocket)'
  ),
  'production Redis RESP state is socket-scoped'
)


check(
  redis.includes(
    'rejectPending(\n        s,'
  ) ||
  redis.includes(
    'rejectPending(\n        s,'
  ),
  'Redis close/error rejection is scoped to owning socket'
)


check(
  redis.includes(
    'state.pending.splice('
  ),
  'timed-out Redis command is removed from owning pending queue'
)


check(
  runtime.includes(
    'D10F8A_REDIS_UNAVAILABLE_OK'
  ),
  'runtime injects unavailable Redis endpoint'
)


check(
  runtime.includes(
    'D10F8A_REDIS_TIMEOUT_RECOVERY_OK'
  ),
  'runtime verifies Redis timeout recovery'
)


check(
  runtime.includes(
    'connectionCount >='
  ),
  'runtime proves Redis reconnect creates another TCP connection'
)


check(
  pkg.scripts?.[
    'test:integration:failure-injection'
  ] ===
  'node tests/integration/failure-injection-runtime.integration.mjs',
  'D10F.8A runtime package script exists'
)


check(
  pkg.scripts?.[
    'failure-injection-runtime-check'
  ] ===
  'node scripts/d10f-failure-injection-runtime-selftest.mjs',
  'D10F.8A structural package script exists'
)


const gate =
  String(
    pkg.scripts?.[
      'ci:gate'
    ] ||
    ''
  )


check(
  gate.includes(
    'npm run playwright-critical-check && npm run failure-injection-runtime-check'
  ),
  'D10F.8A static gate follows D10F.7'
)


check(
  workflow.includes(
    'name: PostgreSQL Redis failure injection runtime'
  ),
  'CI contains D10F.8A runtime step'
)


check(
  workflow.includes(
    'run: npm run test:integration:failure-injection'
  ),
  'CI executes D10F.8A runtime'
)


const workerIndex =
  workflow.indexOf(
    'name: Worker retry background-job runtime'
  )


const failureIndex =
  workflow.indexOf(
    'name: PostgreSQL Redis failure injection runtime'
  )


const playwrightInstallIndex =
  workflow.indexOf(
    'name: Install Playwright Chromium'
  )


check(
  workerIndex >= 0 &&
  failureIndex > workerIndex &&
  playwrightInstallIndex > failureIndex,
  'CI order is worker runtime -> failure injection -> Playwright'
)


if(
  failures.length
){

  console.error('')
  console.error(
    `MELEO D10F.8A structural self-test: ${failures.length} failure(s)`
  )

  process.exit(
    1
  )
}


console.log('')
console.log(
  'MELEO D10F.8A failure injection structural self-test: OK'
)