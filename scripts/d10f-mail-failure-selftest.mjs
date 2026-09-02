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
    'tests/integration/mail-failure.integration.mjs'
  )


const mail =
  read(
    'server/mail.js'
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
    'D10F.8C refuses NODE_ENV=production'
  ),
  'D10F.8C runtime refuses production mode'
)


check(
  runtime.includes(
    'D10F8C_RESEND_500_OK'
  ) &&
  runtime.includes(
    'Resend 500'
  ),
  'runtime injects real Resend HTTP 500'
)


check(
  runtime.includes(
    'Deliberately never respond'
  ) &&
  runtime.includes(
    'D10F8C_RESEND_TIMEOUT_OK'
  ),
  'runtime injects hung Resend HTTP request'
)


check(
  runtime.includes(
    'D10F8C_RESEND_RECOVERY_OK'
  ),
  'runtime verifies healthy mail recovery'
)


check(
  runtime.includes(
    'D10F8C_MAIL_DISABLED_OK'
  ),
  'runtime preserves disabled-mail semantics'
)


check(
  config.includes(
    'apiUrl:'
  ) &&
  config.includes(
    'RESEND_API_URL'
  ),
  'mail configuration exposes injectable provider endpoint'
)


check(
  config.includes(
    'requestTimeoutMs:'
  ) &&
  config.includes(
    'RESEND_REQUEST_TIMEOUT_MS'
  ),
  'mail configuration exposes bounded request timeout'
)


check(
  mail.includes(
    'config.mail.apiUrl'
  ),
  'production mail uses configured Resend endpoint'
)


check(
  mail.includes(
    'AbortSignal.timeout'
  ),
  'production mail request uses AbortSignal timeout'
)


check(
  mail.includes(
    "'Resend request timeout'"
  ),
  'production mail timeout is normalized'
)


check(
  mail.includes(
    "return { delivered: false, reason: err.message }"
  ),
  'controlled mail failure contract preserved'
)


check(
  mail.includes(
    "if (!config.mailEnabled)"
  ) &&
  mail.includes(
    "reason: 'mail_not_configured'"
  ),
  'disabled-mail fallback preserved'
)


check(
  !mail.includes(
    'await tx('
  ),
  'mail HTTP delivery does not open PostgreSQL transaction'
)


check(
  pkg.scripts?.[
    'test:integration:mail-failure'
  ] ===
  'node tests/integration/mail-failure.integration.mjs',
  'D10F.8C runtime package script exists'
)


check(
  pkg.scripts?.[
    'mail-failure-check'
  ] ===
  'node scripts/d10f-mail-failure-selftest.mjs',
  'D10F.8C structural package script exists'
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
    'npm run object-storage-failure-check && npm run mail-failure-check'
  ),
  'D10F.8C static gate follows D10F.8B'
)


check(
  workflow.includes(
    'name: Transactional mail failure injection runtime'
  ),
  'CI contains D10F.8C runtime step'
)


check(
  workflow.includes(
    'run: npm run test:integration:mail-failure'
  ),
  'CI executes D10F.8C runtime'
)


const storageIndex =
  workflow.indexOf(
    'name: Object storage S3 failure injection runtime'
  )


const mailIndex =
  workflow.indexOf(
    'name: Transactional mail failure injection runtime'
  )


const playwrightIndex =
  workflow.indexOf(
    'name: Install Playwright Chromium'
  )


check(
  storageIndex >=
    0 &&
  mailIndex >
    storageIndex &&
  playwrightIndex >
    mailIndex,
  'CI order is D10F.8B -> D10F.8C -> Playwright'
)


if(
  failures.length
){

  console.error('')

  console.error(
    `MELEO D10F.8C structural self-test: ${failures.length} failure(s)`
  )


  process.exit(
    1
  )
}


console.log('')

console.log(
  'MELEO D10F.8C transactional-mail failure structural self-test: OK'
)