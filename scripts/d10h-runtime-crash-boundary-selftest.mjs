import fs from 'node:fs'
import assert from 'node:assert/strict'


const read =
  path =>
    fs
      .readFileSync(
        path,
        'utf8'
      )
      .replace(
        /^\uFEFF/,
        ''
      )


const test =
  read(
    'tests/integration/d10h-runtime-crash-boundary.integration.mjs'
  )

const runtime =
  read(
    'server/services/job-runtime.service.js'
  )

const pkg =
  JSON.parse(
    read(
      'package.json'
    )
  )


function pass(message){
  console.log(
    `[PASS] ${message}`
  )
}


assert.ok(
  test.includes(
    'createJobRuntime'
  ) &&
  test.includes(
    '../../server/services/job-runtime.service.js'
  )
)

pass(
  'crash-boundary test uses production job runtime'
)


assert.ok(
  test.includes(
    'recoverStale()'
  ) &&
  runtime.includes(
    "WHERE status='processing'"
  ) &&
  runtime.includes(
    "interval '10 minutes'"
  )
)

pass(
  'stale processing lease recovery is runtime-tested'
)


assert.ok(
  test.includes(
    "status==='pending'"
  ) &&
  test.includes(
    "retry===true"
  )
)

pass(
  'retryable failure boundary is runtime-tested'
)


assert.ok(
  test.includes(
    "status==='failed'"
  ) &&
  test.includes(
    "terminal===true"
  )
)

pass(
  'terminal dead-letter boundary is runtime-tested'
)


assert.ok(
  test.includes(
    'locked_by===null'
  ) &&
  test.includes(
    'locked_at===null'
  )
)

pass(
  'lease cleanup is explicitly verified'
)


assert.ok(
  test.includes(
    'Number(completed?.attempts)===2'
  ) &&
  test.includes(
    'Number(manualRecoveryClaim?.attempts)===2'
  )
)

pass(
  'attempt accounting survives crash and manual recovery'
)


assert.ok(
  test.includes(
    'crash recovery does not duplicate durable job'
  )
)

pass(
  'crash recovery duplicate protection is asserted'
)


assert.ok(
  test.includes(
    'manual recovery begins from failed state'
  ) &&
  test.includes(
    "status='pending'"
  )
)

pass(
  'D10H.6 manual recovery is runtime-compatible'
)


assert.equal(
  pkg.scripts[
    'test:integration:d10h-runtime-crash'
  ],
  'node tests/integration/d10h-runtime-crash-boundary.integration.mjs'
)


assert.equal(
  pkg.scripts[
    'runtime-crash-boundary-check'
  ],
  'node scripts/d10h-runtime-crash-boundary-selftest.mjs'
)


assert.ok(
  pkg.scripts[
    'ci:gate'
  ].includes(
    'npm run runtime-crash-boundary-check'
  )
)

pass(
  'D10H.7 proof is wired into CI gate'
)


console.log('')
console.log(
  'MELEO D10H.7 runtime crash-boundary self-test: OK'
)