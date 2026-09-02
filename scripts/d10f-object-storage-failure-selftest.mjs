import fs from 'node:fs'


const failures =
  []


function read(
  path
){
  return fs
    .readFileSync(
      path,
      'utf8'
    )
    .replace(
      /^\uFEFF/,
      ''
    )
    .replace(
      /\r\n/g,
      '\n'
    )
}


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
  read(
    'tests/integration/object-storage-failure.integration.mjs'
  )


const storage =
  read(
    'server/object-storage.js'
  )


const config =
  read(
    'server/config.js'
  )


const workflow =
  read(
    '.github/workflows/quality-gate.yml'
  )


const pkg =
  JSON.parse(
    read(
      'package.json'
    )
  )


check(
  runtime.includes(
    'D10F.8B refuses NODE_ENV=production'
  ),
  'D10F.8B runtime refuses production mode'
)


check(
  runtime.includes(
    "S3 PUT failed: 500"
  ) &&
  runtime.includes(
    'D10F8B_S3_500_OK'
  ),
  'runtime injects real S3 HTTP 500 failure'
)


check(
  runtime.includes(
    'Deliberately never respond'
  ) &&
  runtime.includes(
    'D10F8B_S3_TIMEOUT_OK'
  ),
  'runtime injects hung S3 request'
)


check(
  runtime.includes(
    'D10F8B_S3_RECOVERY_OK'
  ),
  'runtime verifies storage recovery'
)


check(
  runtime.includes(
    'putVerificationObject'
  ) &&
  runtime.includes(
    'getVerificationObject'
  ) &&
  runtime.includes(
    'deleteVerificationObject'
  ),
  'runtime exercises PUT GET DELETE object lifecycle'
)


check(
  config.includes(
    'requestTimeoutMs:'
  ) &&
  config.includes(
    'S3_REQUEST_TIMEOUT_MS'
  ),
  'storage configuration exposes bounded S3 request timeout'
)


check(
  storage.includes(
    'AbortSignal.timeout'
  ),
  'production S3 request uses AbortSignal timeout'
)


check(
  storage.includes(
    "'S3 ' + method + ' timeout'"
  ) ||
  storage.includes(
    '`S3 ${method} timeout`'
  ),
  'production S3 timeout is normalized to canonical error'
)


check(
  pkg.scripts?.[
    'test:integration:object-storage-failure'
  ] ===
  'node tests/integration/object-storage-failure.integration.mjs',
  'D10F.8B runtime package script exists'
)


check(
  pkg.scripts?.[
    'object-storage-failure-check'
  ] ===
  'node scripts/d10f-object-storage-failure-selftest.mjs',
  'D10F.8B structural package script exists'
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
    'npm run failure-injection-runtime-check && npm run object-storage-failure-check'
  ),
  'D10F.8B static gate follows D10F.8A'
)


check(
  workflow.includes(
    'name: Object storage S3 failure injection runtime'
  ),
  'CI contains D10F.8B runtime step'
)


check(
  workflow.includes(
    'run: npm run test:integration:object-storage-failure'
  ),
  'CI executes D10F.8B runtime'
)


const d10f8a =
  workflow.indexOf(
    'name: PostgreSQL Redis failure injection runtime'
  )


const d10f8b =
  workflow.indexOf(
    'name: Object storage S3 failure injection runtime'
  )


const playwright =
  workflow.indexOf(
    'name: Install Playwright Chromium'
  )


check(
  d10f8a >=
    0 &&
  d10f8b >
    d10f8a &&
  playwright >
    d10f8b,
  'CI order is D10F.8A -> D10F.8B -> Playwright'
)


if(
  failures.length
){

  console.error('')

  console.error(
    `MELEO D10F.8B structural self-test: ${failures.length} failure(s)`
  )


  process.exit(
    1
  )
}


console.log('')

console.log(
  'MELEO D10F.8B object-storage failure structural self-test: OK'
)