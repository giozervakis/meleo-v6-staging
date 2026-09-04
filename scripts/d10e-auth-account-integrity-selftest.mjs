import fs from 'node:fs'

const read=
  path=>
    fs.readFileSync(
      path,
      'utf8'
    )
      .replace(/^\uFEFF/,'')
      .replace(/\r\n/g,'\n')


const app=
  read(
    'server/relational/app.js'
  )

const authRoutes=
  read(
    'server/routes/auth-account.routes.js'
  )

const pkg=
  JSON.parse(
    read(
      'package.json'
    )
  )


function check(
  condition,
  message
){
  if(!condition){
    console.error(
      '[FAIL]',
      message
    )

    process.exitCode=1

    return
  }

  console.log(
    '[PASS]',
    message
  )
}


function section(
  source,
  startMarker,
  endMarker
){
  const start=
    source.indexOf(
      startMarker
    )

  const end=
    source.indexOf(
      endMarker,
      start+
        Math.max(
          1,
          startMarker.length
        )
    )

  if(
    start<0 ||
    end<=start
  ){
    return ''
  }

  return source.slice(
    start,
    end
  )
}


// ==========================================================
// TX DEPENDENCY
// ==========================================================

const authHeader=
  section(
    authRoutes,
    'export function registerAuthAccountRoutes',
    "app.post('/api/auth/register'"
  )


check(
  /clearSessionCookie\s*,\s*tx\s*,/.test(
    authHeader
  ),
  'auth-account receives tx dependency'
)


const registrationStart=
  app.indexOf(
    'registerAuthAccountRoutes('
  )

const registrationEnd=
  app.indexOf(
    'registerAccountProfileRoutes(',
    registrationStart
  )

const registration=
  (
    registrationStart>=0 &&
    registrationEnd>registrationStart
  )
    ? app.slice(
        registrationStart,
        registrationEnd
      )
    : ''


check(
  /clearSessionCookie\s*,\s*tx\s*,/.test(
    registration
  ),
  'composition root injects tx'
)


// ==========================================================
// consumeToken
// ==========================================================

const tokenService =
  fs.readFileSync(
    'server/services/one-time-token.service.js',
    'utf8'
  )

const consume=
  section(
    tokenService,
    'async function consumeToken(',
    'return Object.freeze({'
  )


check(
  /consumeToken\s*\(\s*raw\s*,\s*type\s*,\s*client\s*=\s*null\s*\)/.test(
    consume
  ),
  'consumeToken accepts optional transaction client'
)


check(
  /client\s*\?\s*consume\s*\(\s*client\s*\)/.test(
    consume
  ),
  'consumeToken reuses caller transaction'
)


check(
  /:\s*tx\s*\(\s*consume\s*\)/.test(
    consume
  ),
  'consumeToken preserves standalone transaction behavior'
)


check(
  /FOR\s+UPDATE/.test(
    consume
  ),
  'consumeToken keeps row lock'
)


check(
  /used_at\s*=\s*now\s*\(\s*\)/.test(
    consume
  ),
  'consumeToken still marks token used'
)


// ==========================================================
// RESET PASSWORD
// ==========================================================

const reset=
  section(
    authRoutes,
    "'/api/auth/reset-password'",
    "'/api/auth/verify-email'"
  )


check(
  /const\s+passwordHash\s*=\s*await\s+hashPassword\s*\(/.test(
    reset
  ),
  'reset-password hashes password before transactional writes'
)


check(
  /await\s+tx\s*\(\s*async\s+client\s*=>\s*\{/.test(
    reset
  ),
  'reset-password uses one transaction'
)


check(
  /consumeToken\s*\([\s\S]*?['"]password_reset['"]\s*,\s*client\s*\)/.test(
    reset
  ),
  'reset-password consumes token with same client'
)


check(
  /UPDATE\s+users[\s\S]*?password_hash\s*=\s*\$2/.test(
    reset
  ),
  'reset-password updates password transactionally'
)


check(
  /DELETE\s+FROM\s+sessions[\s\S]*?WHERE\s+user_id\s*=\s*\$1/.test(
    reset
  ),
  'reset-password revokes sessions transactionally'
)


check(
  !/Users\.update\s*\(/.test(
    reset
  ),
  'split reset-password Users.update removed'
)


check(
  !/Sessions\.revokeUser\s*\(/.test(
    reset
  ),
  'split reset-password Sessions.revokeUser removed'
)


// ==========================================================
// VERIFY EMAIL
// ==========================================================

const verify=
  section(
    authRoutes,
    "'/api/auth/verify-email'",
    "'/api/auth/verify-email/resend'"
  )


check(
  /await\s+tx\s*\(\s*async\s+client\s*=>\s*\{/.test(
    verify
  ),
  'verify-email uses one transaction'
)


check(
  /consumeToken\s*\([\s\S]*?['"]verify_email['"]\s*,\s*client\s*\)/.test(
    verify
  ),
  'verify-email consumes token with same client'
)


check(
  /email_verified\s*=\s*true/.test(
    verify
  ),
  'verify-email user mutation is transactional'
)


check(
  !/Users\.update\s*\(/.test(
    verify
  ),
  'split verify-email Users.update removed'
)


// ==========================================================
// ENABLE PROFESSIONAL
// ==========================================================

const enable=
  section(
    authRoutes,
    "'/api/me/enable-professional'",
    "'/api/me/sessions'"
  )


check(
  /await\s+tx\s*\(\s*async\s+client\s*=>\s*\{/.test(
    enable
  ),
  'enable-professional uses one transaction'
)


check(
  /INSERT\s+INTO\s+professionals/.test(
    enable
  ) &&
  /ON\s+CONFLICT\s*\(\s*user_id\s*\)/.test(
    enable
  ),
  'professional creation is idempotent inside transaction'
)


check(
  /role\s*=\s*['"]professional['"]/.test(
    enable
  ),
  'user role promotion is transactional'
)


check(
  /onboarding_completed\s*=\s*false/.test(
    enable
  ),
  'professional onboarding mutation is transactional'
)


check(
  /audit\s*\([\s\S]*?['"]professional\.enable['"][\s\S]*?client\s*\)/.test(
    enable
  ),
  'professional.enable audit receives transaction client'
)


check(
  !/Professionals\.createForUser\s*\(/.test(
    enable
  ),
  'split professional creation removed'
)


check(
  !/Users\.update\s*\(/.test(
    enable
  ),
  'split role update removed'
)


check(
  !/Professionals\.update\s*\(/.test(
    enable
  ),
  'split professional update removed'
)


// ==========================================================
// REVOKE OTHER SESSIONS
// ==========================================================

const others=
  section(
    authRoutes,
    "'/api/me/sessions/others'",
    "'/api/me'"
  )


check(
  /await\s+tx\s*\(\s*async\s+client\s*=>\s*\{/.test(
    others
  ),
  'revoke-other-sessions uses transaction'
)


check(
  /DELETE\s+FROM\s+sessions/.test(
    others
  ),
  'other sessions are deleted transactionally'
)


check(
  /audit\s*\([\s\S]*?['"]security\.sessions_revoke_others['"][\s\S]*?client\s*\)/.test(
    others
  ),
  'session revocation audit receives transaction client'
)


check(
  !/Sessions\.revokeOthers\s*\(/.test(
    others
  ),
  'split Sessions.revokeOthers removed'
)


// ==========================================================
// PACKAGE / CI
// ==========================================================

check(
  pkg.scripts?.[
    'auth-account-integrity-check'
  ] ===
    'node scripts/d10e-auth-account-integrity-selftest.mjs',
  'D10E.5B package script exists'
)


check(
  (
    pkg.scripts?.[
      'ci:gate'
    ] || ''
  ).includes(
    'npm run account-privacy-integrity-check && npm run auth-account-integrity-check'
  ),
  'D10E.5B is chained after D10E.5A'
)


if(
  !process.exitCode
){
  console.log('')

  console.log(
    'MELEO D10E.5B auth account integrity self-test: OK'
  )
}
