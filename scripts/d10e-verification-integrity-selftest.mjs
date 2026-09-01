import fs from 'node:fs'

const read = path =>
  fs.readFileSync(path, 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')

const repo =
  read('server/relational/repositories.js')

const app =
  read('server/relational/app.js')

const admin =
  read('server/routes/admin-verification.routes.js')

const professional =
  read('server/routes/professional-verification.routes.js')

const pkg =
  JSON.parse(
    read('package.json')
  )

const checks = []

function check(condition, message) {
  if (!condition) {
    console.error('[FAIL]', message)
    process.exitCode = 1
  }
  else {
    console.log('[PASS]', message)
  }

  checks.push({
    condition,
    message
  })
}


// ----------------------------------------------------------
// audit transaction contract
// ----------------------------------------------------------

check(
  repo.includes(
    'export async function audit(actorId,action,meta={},client=null)'
  ),
  'audit supports optional transaction client'
)

check(
  repo.includes(
    'client?.query?client.query.bind(client):sql'
  ),
  'audit falls back to global sql for legacy callers'
)


// ----------------------------------------------------------
// professional verification dependencies
// ----------------------------------------------------------

const regStart =
  app.indexOf(
    'registerProfessionalVerificationRoutes('
  )

const regEnd =
  app.indexOf(
    'registerProfessionalBillingRoutes(',
    regStart
  )

const reg =
  (
    regStart >= 0 &&
    regEnd > regStart
  )
    ? app.slice(
        regStart,
        regEnd
      )
    : ''

check(
  reg.includes(
    '    many,'
  ),
  'professional verification receives many dependency'
)

check(
  reg.includes(
    '    tx,'
  ),
  'professional verification receives tx dependency'
)

check(
  professional.includes(
    '    many,'
  ),
  'professional verification route declares many dependency'
)

check(
  professional.includes(
    '    tx,'
  ),
  'professional verification route declares tx dependency'
)


// ----------------------------------------------------------
// professional submit atomicity
// ----------------------------------------------------------

const submitStart =
  professional.indexOf(
    "app.post('/api/professional/verification'"
  )

const submit =
  submitStart >= 0
    ? professional.slice(
        submitStart
      )
    : ''

check(
  submit.includes(
    'await tx(async c=>{'
  ),
  'professional verification submission uses transaction'
)

check(
  submit.includes(
    'await c.query(`INSERT INTO verification_requests'
  ),
  'verification request insert uses transaction client'
)

check(
  submit.includes(
    "await c.query(`UPDATE professionals SET onboarding_stage='pending_verification'"
  ),
  'professional onboarding update uses transaction client'
)

check(
  !submit.includes(
    'Professionals.update(p.id'
  ),
  'split Professionals.update removed from verification submission'
)

check(
  submit.includes(
    "await audit(req.user.id,'verification.submit',{professionalId:p.id},c)"
  ),
  'verification submission audit receives same transaction client'
)


// ----------------------------------------------------------
// upload compensation preserved
// ----------------------------------------------------------

const uploadStart =
  professional.indexOf(
    "app.post('/api/professional/verification-document'"
  )

const uploadEnd =
  professional.indexOf(
    "app.get('/api/professional/verification-documents'",
    uploadStart
  )

const upload =
  (
    uploadStart >= 0 &&
    uploadEnd > uploadStart
  )
    ? professional.slice(
        uploadStart,
        uploadEnd
      )
    : ''

check(
  upload.includes(
    'putVerificationObject('
  ),
  'verification document object write preserved'
)

check(
  upload.includes(
    'INSERT INTO verification_documents'
  ),
  'verification document database insert preserved'
)

check(
  upload.includes(
    'deleteVerificationObject(storageKey)'
  ),
  'verification document compensating delete preserved'
)


// ----------------------------------------------------------
// admin decision atomicity
// ----------------------------------------------------------

const adminStart =
  admin.indexOf(
    "'/api/admin/verifications/:id'"
  )

const adminDecision =
  adminStart >= 0
    ? admin.slice(
        adminStart
      )
    : ''

check(
  adminDecision.includes(
    'await tx('
  ),
  'admin verification decision uses transaction'
)

check(
  adminDecision.includes(
    'UPDATE verification_requests'
  ),
  'verification decision request update preserved'
)

check(
  adminDecision.includes(
    'UPDATE professionals'
  ),
  'verification decision professional update preserved'
)

const txStart =
  adminDecision.indexOf(
    '      await tx('
  )

const mailStart =
  adminDecision.indexOf(
    '      if(u){\n        mail'
  )

const responseStart =
  adminDecision.indexOf(
    '      res.json({'
  )

const txArea =
  (
    txStart >= 0 &&
    mailStart > txStart
  )
    ? adminDecision.slice(
        txStart,
        mailStart
      )
    : ''

const postTxArea =
  (
    mailStart >= 0 &&
    responseStart > mailStart
  )
    ? adminDecision.slice(
        mailStart,
        responseStart
      )
    : ''

check(
  txArea.includes(
    'Notifications.create('
  ),
  'admin verification notification executes inside transaction'
)

check(
  txArea.includes(
    '{},\n                c'
  ),
  'admin verification notification receives transaction client'
)

check(
  txArea.includes(
    'await audit('
  ),
  'admin verification audit executes inside transaction'
)

check(
  txArea.includes(
    '            c\n          )'
  ),
  'admin verification audit receives transaction client'
)

check(
  !postTxArea.includes(
    'Notifications.create('
  ),
  'no post-transaction admin verification notification remains'
)

check(
  !postTxArea.includes(
    'await audit('
  ),
  'no post-transaction admin verification audit remains'
)

check(
  postTxArea.includes(
    '.verificationDecision('
  ),
  'verification email remains post-commit'
)


// ----------------------------------------------------------
// package / CI
// ----------------------------------------------------------

check(
  pkg.scripts?.['verification-integrity-check'] ===
    'node scripts/d10e-verification-integrity-selftest.mjs',
  'D10E.2 package script exists'
)

const gate =
  pkg.scripts?.['ci:gate'] || ''

check(
  gate.includes(
    'npm run support-message-integrity-check && npm run verification-integrity-check'
  ),
  'D10E.2 is chained after D10E.1'
)


// ----------------------------------------------------------
// final
// ----------------------------------------------------------

if (
  checks.every(
    x => x.condition
  )
) {
  console.log('')
  console.log(
    'MELEO D10E.2 verification integrity self-test: OK'
  )
}
else {
  process.exitCode = 1
}
