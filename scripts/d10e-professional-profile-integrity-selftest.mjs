import fs from 'node:fs'

const read = path =>
  fs.readFileSync(path,'utf8')
    .replace(/^\\uFEFF/,'')
    .replace(/\\r\\n/g,'\\n')

const core =
  read('server/routes/professional-core.routes.js')

const app =
  read('server/relational/app.js')

const reports =
  read('server/routes/reports.routes.js')

const pkg =
  JSON.parse(
    read('package.json')
  )

const checks=[]

function check(condition,message){
  if(condition){
    console.log('[PASS]',message)
  }
  else{
    console.error('[FAIL]',message)
    process.exitCode=1
  }

  checks.push({condition,message})
}


// ----------------------------------------------------------
// dependency contract
// ----------------------------------------------------------

const regStart =
  app.indexOf(
    'registerProfessionalCoreRoutes('
  )

const regEnd =
  app.indexOf(
    'registerSeoRoutes(',
    regStart
  )

const reg =
  regStart >= 0 &&
  regEnd > regStart
    ? app.slice(regStart,regEnd)
    : ''

check(
  reg.includes('    tx'),
  'professional-core receives tx dependency'
)

const coreHeader =
  core.slice(
    0,
    core.indexOf(
      "app.get('/api/professionals'"
    )
  )

check(
  coreHeader.includes(
    '    tx'
  ),
  'professional-core declares tx dependency'
)


// ----------------------------------------------------------
// profile route
// ----------------------------------------------------------

const profileStart =
  core.indexOf(
    "'/api/professional/profile'"
  )

const availabilityStart =
  core.indexOf(
    '// MELEO V7 PHASE 6E.2 PROFESSIONAL AVAILABILITY ROUTES',
    profileStart
  )

const profile =
  profileStart >= 0 &&
  availabilityStart > profileStart
    ? core.slice(
        profileStart,
        availabilityStart
      )
    : ''

check(
  profile.includes(
    'await tx(async c=>{'
  ),
  'professional profile uses transaction'
)

check(
  profile.includes(
    'UPDATE professionals'
  ),
  'profile patch executes transactional SQL'
)

check(
  profile.includes(
    "onboarding_stage='verification'"
  ),
  'onboarding transition preserved'
)

check(
  profile.includes(
    'await c.query('
  ),
  'profile database operations use transaction client'
)

check(
  profile.includes(
    'SELECT'
  ) &&
  profile.includes(
    'onboarding_stage'
  ) &&
  profile.includes(
    'FROM professionals'
  ),
  'profile evaluates post-patch state inside transaction'
)

check(
  !profile.includes(
    'Professionals.update('
  ),
  'split Professionals.update calls removed'
)

check(
  profile.includes(
    'row?.specialty'
  ) &&
  profile.includes(
    'row?.title'
  ) &&
  profile.includes(
    'row?.city'
  ),
  'profile completeness logic preserved'
)

check(
  profile.includes(
    "'pending_verification'"
  ) &&
  profile.includes(
    "'approved'"
  ),
  'protected onboarding stages preserved'
)

check(
  profile.includes(
    'await Professionals.byId('
  ),
  'profile response still returns repository-shaped professional'
)


// ----------------------------------------------------------
// availability preserved
// ----------------------------------------------------------

const availability =
  core.slice(
    availabilityStart
  )

check(
  availability.includes(
    'await tx(async client=>{'
  ),
  'availability transaction preserved'
)

check(
  availability.includes(
    'DELETE FROM professional_availability_slots'
  ) &&
  availability.includes(
    'INSERT INTO professional_availability_slots'
  ),
  'availability slot replacement preserved'
)

check(
  availability.includes(
    'DELETE FROM professional_availability_exceptions'
  ) &&
  availability.includes(
    'INSERT INTO professional_availability_exceptions'
  ),
  'availability exception replacement preserved'
)


// ----------------------------------------------------------
// reports remains single-write
// ----------------------------------------------------------

const reportWrites =
  (
    reports.match(
      /await sql\(/g
    ) || []
  ).length

check(
  reportWrites === 1,
  'reports remains single durable write'
)

check(
  !reports.includes(
    'await tx('
  ),
  'reports does not gain unnecessary transaction'
)


// ----------------------------------------------------------
// package / ci
// ----------------------------------------------------------

check(
  pkg.scripts?.[
    'professional-profile-integrity-check'
  ] ===
    'node scripts/d10e-professional-profile-integrity-selftest.mjs',
  'D10E.4 package script exists'
)

const gate =
  pkg.scripts?.['ci:gate'] || ''

check(
  gate.includes(
    'npm run favorites-smart-request-integrity-check && npm run professional-profile-integrity-check'
  ),
  'D10E.4 is chained after D10E.3'
)


// ----------------------------------------------------------
// final
// ----------------------------------------------------------

if(
  checks.every(
    x=>x.condition
  )
){
  console.log('')
  console.log(
    'MELEO D10E.4 professional profile integrity self-test: OK'
  )
}
else{
  process.exitCode=1
}
