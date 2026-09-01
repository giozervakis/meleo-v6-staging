import fs from 'node:fs'

const read=path=>
  fs.readFileSync(path,'utf8')
    .replace(/^\\uFEFF/,'')
    .replace(/\\r\\n/g,'\\n')

const route=
  read(
    'server/routes/account-privacy.routes.js'
  )

const pkg=
  JSON.parse(
    read('package.json')
  )

const checks=[]

function check(condition,message){
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
    process.exitCode=1
  }

  checks.push({
    condition,
    message
  })
}


// ----------------------------------------------------------
// change password
// ----------------------------------------------------------

const changeStart=
  route.indexOf(
    "'/api/me/change-password'"
  )

const exportStart=
  route.indexOf(
    "'/api/me/export'",
    changeStart
  )

const change=
  changeStart>=0 &&
  exportStart>changeStart
    ? route.slice(
        changeStart,
        exportStart
      )
    : ''

check(
  change.includes(
    'const passwordHash='
  ),
  'password hash is computed before transactional writes'
)

check(
  change.includes(
    'await tx(async client=>{'
  ),
  'change-password uses database transaction'
)

check(
  change.includes(
    'UPDATE users'
  ) &&
  change.includes(
    'password_hash=$2'
  ),
  'password update executes transactionally'
)

check(
  change.includes(
    'DELETE FROM sessions'
  ),
  'session revocation executes transactionally'
)

check(
  change.indexOf(
    'UPDATE users'
  ) <
  change.indexOf(
    'DELETE FROM sessions'
  ),
  'password update precedes session revocation'
)

check(
  !change.includes(
    'Users.update('
  ),
  'change-password split Users.update removed'
)

check(
  !change.includes(
    'Sessions.revokeUser('
  ),
  'change-password split session repository call removed'
)

check(
  change.indexOf(
    'clearSessionCookie(res)'
  ) >
  change.indexOf(
    'await tx(async client=>{'
  ),
  'session cookie is cleared after transactional commit'
)


// ----------------------------------------------------------
// account deletion
// ----------------------------------------------------------

const deleteStart=
  route.indexOf(
    "app.delete("
  )

const deletion=
  deleteStart>=0
    ? route.slice(deleteStart)
    : ''

check(
  deletion.includes(
    "stripe"
  ) &&
  deletion.includes(
    '.subscriptions'
  ) &&
  deletion.includes(
    '.cancel('
  ),
  'Stripe cancellation preserved'
)

check(
  deletion.includes(
    'deleteVerificationObject('
  ),
  'verification storage deletion preserved'
)

check(
  deletion.includes(
    'mail'
  ) &&
  deletion.includes(
    '.accountDeleted('
  ),
  'account-deleted email preserved'
)


// ----------------------------------------------------------
// Stripe failure pending state + audit
// ----------------------------------------------------------

const stripeAudit=
  deletion.indexOf(
    "'privacy.deletion_pending'"
  )

check(
  stripeAudit>=0,
  'Stripe failure audit preserved'
)

const stripeTxStart=
  deletion.lastIndexOf(
    'await tx(async client=>{',
    stripeAudit
  )

check(
  stripeTxStart>=0 &&
  stripeTxStart<stripeAudit,
  'Stripe failure pending flow uses transaction'
)

const stripeArea=
  deletion.slice(
    stripeTxStart,
    stripeAudit+500
  )

check(
  stripeArea.includes(
    'UPDATE users'
  ) &&
  stripeArea.includes(
    'deletion_pending=true'
  ),
  'Stripe failure pending state is transactional'
)

check(
  stripeArea.includes(
    "'privacy.deletion_pending'"
  ) &&
  stripeArea.includes(
    'client'
  ),
  'Stripe failure audit receives transaction client'
)


// ----------------------------------------------------------
// storage failure pending state + audit
// ----------------------------------------------------------

const storageAudit=
  deletion.indexOf(
    "'privacy.verification_storage_delete_failed'"
  )

check(
  storageAudit>=0,
  'storage failure audit preserved'
)

const storageTxStart=
  deletion.lastIndexOf(
    'await tx(async client=>{',
    storageAudit
  )

check(
  storageTxStart>=0 &&
  storageTxStart<storageAudit,
  'storage failure pending flow uses transaction'
)

const storageArea=
  deletion.slice(
    storageTxStart,
    storageAudit+650
  )

check(
  storageArea.includes(
    'UPDATE users'
  ) &&
  storageArea.includes(
    'deletion_pending=true'
  ),
  'storage failure pending state is transactional'
)

check(
  storageArea.includes(
    "'privacy.verification_storage_delete_failed'"
  ) &&
  storageArea.includes(
    'client'
  ),
  'storage failure audit receives transaction client'
)


// ----------------------------------------------------------
// final deletion transaction
// ----------------------------------------------------------

const finalAudit=
  deletion.indexOf(
    "'privacy.account_deleted'"
  )

check(
  finalAudit>=0,
  'final account deletion audit preserved'
)

const finalTxStart=
  deletion.lastIndexOf(
    'await tx(async client=>{',
    finalAudit
  )

const mailPos=
  deletion.indexOf(
    '.accountDeleted('
  )

check(
  finalTxStart>=0 &&
  finalTxStart<finalAudit,
  'final account deletion audit is inside transaction'
)

const finalArea=
  deletion.slice(
    finalTxStart,
    finalAudit+700
  )

check(
  finalArea.includes(
    "'privacy.account_deleted'"
  ) &&
  finalArea.includes(
    'client'
  ),
  'final account deletion audit receives transaction client'
)

check(
  mailPos>finalAudit,
  'account-deleted email remains post-transaction'
)

const stripeCancelPos=
  deletion.indexOf(
    '.subscriptions'
  )

const storageDeletePos=
  deletion.indexOf(
    'deleteVerificationObject('
  )

check(
  stripeCancelPos>=0 &&
  stripeCancelPos<finalTxStart,
  'Stripe remains outside final DB transaction'
)

check(
  storageDeletePos>=0 &&
  storageDeletePos<finalTxStart,
  'verification object deletion remains outside final DB transaction'
)


// ----------------------------------------------------------
// package / CI
// ----------------------------------------------------------

check(
  pkg.scripts?.[
    'account-privacy-integrity-check'
  ] ===
    'node scripts/d10e-account-privacy-integrity-selftest.mjs',
  'D10E.5A package script exists'
)

const gate=
  pkg.scripts?.['ci:gate'] || ''

check(
  gate.includes(
    'npm run professional-profile-integrity-check && npm run account-privacy-integrity-check'
  ),
  'D10E.5A is chained after D10E.4'
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
    'MELEO D10E.5A account privacy integrity self-test: OK'
  )
}
else{
  process.exitCode=1
}
