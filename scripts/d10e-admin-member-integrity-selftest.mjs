import fs from 'node:fs'

const read=
  path=>
    fs.readFileSync(path,'utf8')
      .replace(/^\uFEFF/,'')
      .replace(/\r\n/g,'\n')

const route=
  read(
    'server/routes/admin-members.routes.js'
  )

const app=
  read(
    'server/relational/app.js'
  )

const pkg=
  JSON.parse(
    read('package.json')
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


const registrationStart=
  app.indexOf(
    'registerAdminMembersRoutes({'
  )

const registrationEnd=
  app.indexOf(
    'registerAdminReportsRoutes({',
    registrationStart
  )

const registration=
  registrationStart>=0 &&
  registrationEnd>registrationStart
    ? app.slice(
        registrationStart,
        registrationEnd
      )
    : ''


check(
  /Professionals\s*,\s*tx\s*,\s*limits/.test(
    route
  ),
  'admin-members receives tx dependency'
)

check(
  /Professionals\s*,\s*tx\s*,[\s\S]*?limits/.test(
    registration
  ),
  'composition root injects tx'
)


const start=
  route.indexOf(
    "'/api/admin/members/:id/action'"
  )

const actionRoute=
  start>=0
    ? route.slice(start)
    : ''


check(
  /await\s+tx\s*\(\s*async\s+client\s*=>/.test(
    actionRoute
  ),
  'admin member action uses transaction'
)

check(
  /UPDATE\s+users[\s\S]*?account_status\s*=\s*['"]suspended['"]/.test(
    actionRoute
  ),
  'suspend mutation is transactional'
)

check(
  /DELETE\s+FROM\s+sessions[\s\S]*?user_id\s*=\s*\$1/.test(
    actionRoute
  ),
  'session revocation is transactional'
)

check(
  /account_status\s*=\s*['"]active['"]/.test(
    actionRoute
  ),
  'reactivate mutation is transactional'
)

check(
  /verified\s*=\s*true/.test(
    actionRoute
  ) &&
  /onboarding_stage\s*=\s*['"]approved['"]/.test(
    actionRoute
  ),
  'verify mutation is transactional'
)

check(
  /verified\s*=\s*false/.test(
    actionRoute
  ) &&
  /onboarding_stage\s*=\s*['"]verification['"]/.test(
    actionRoute
  ),
  'unverify mutation is transactional'
)

check(
  /featured\s*=\s*true/.test(
    actionRoute
  ),
  'feature mutation is transactional'
)

check(
  /featured\s*=\s*false/.test(
    actionRoute
  ),
  'unfeature mutation is transactional'
)

check(
  /audit\s*\([\s\S]*?admin\.member\.\$\{action\}[\s\S]*?client\s*\)/.test(
    actionRoute
  ),
  'admin audit uses same transaction client'
)

check(
  !/Users\.update\s*\(/.test(
    actionRoute
  ),
  'split Users.update removed'
)

check(
  !/Professionals\.update\s*\(/.test(
    actionRoute
  ),
  'split Professionals.update removed'
)

check(
  !/Sessions\.revokeUser\s*\(/.test(
    actionRoute
  ),
  'split Sessions.revokeUser removed'
)

check(
  /p\.subscriptionPlan\s*===\s*['"]premium['"]/.test(
    actionRoute
  ),
  'Premium feature rule preserved'
)

check(
  actionRoute.includes(
    'Μη έγκυρη ενέργεια.'
  ),
  'invalid action behavior preserved'
)

check(
  pkg.scripts?.[
    'admin-member-integrity-check'
  ] ===
    'node scripts/d10e-admin-member-integrity-selftest.mjs',
  'D10E.6A package script exists'
)

check(
  (
    pkg.scripts?.['ci:gate'] ||
    ''
  ).includes(
    'npm run auth-account-integrity-check && npm run admin-member-integrity-check'
  ),
  'D10E.6A chained after D10E.5B'
)


if(!process.exitCode){
  console.log('')

  console.log(
    'MELEO D10E.6A admin member integrity self-test: OK'
  )
}
