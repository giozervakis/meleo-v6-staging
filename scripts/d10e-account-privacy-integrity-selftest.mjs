import fs from 'node:fs'

const read=path=>
  fs.readFileSync(path,'utf8')
    .replace(/^\\uFEFF/,'')
    .replace(/\\r\\n/g,'\\n')

const route=
  read(
    'server/routes/account-privacy.routes.js'
  )

const deletionService=
  read(
    'server/services/account-deletion.service.js'
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
    'await accountDeletion.request('
  ),
  'account deletion delegates to canonical deletion service'
)

check(
  deletion.includes(
    'result.pending'
  ) &&
  deletion.includes(
    '.status(202)'
  ),
  'pending account deletion response preserved'
)

check(
  deletion.includes(
    '.accountDeleted('
  ),
  'account-deleted email preserved'
)

check(
  deletion.indexOf(
    '.accountDeleted('
  ) >
  deletion.indexOf(
    'await accountDeletion.request('
  ),
  'account-deleted email remains after deletion service completion'
)

check(
  deletion.includes(
    'clearSessionCookie(res)'
  ),
  'session cookie is cleared after successful deletion'
)

check(
  deletionService.includes(
    '.subscriptions'
  ) &&
  deletionService.includes(
    '.retrieve('
  ) &&
  deletionService.includes(
    '.cancel('
  ),
  'Stripe cancellation preserved in canonical deletion service'
)

check(
  deletionService.includes(
    'deleteVerificationObject('
  ),
  'verification storage deletion preserved in canonical deletion service'
)

check(
  deletionService.includes(
    "'privacy.deletion_pending'"
  ),
  'Stripe failure pending audit preserved'
)

check(
  deletionService.includes(
    "'privacy.verification_storage_delete_failed'"
  ),
  'storage failure pending audit preserved'
)

check(
  deletionService.includes(
    'deletion_pending=true'
  ),
  'pending deletion state preserved'
)

check(
  deletionService.includes(
    "job_type='account_deletion_retry'"
  ),
  'durable deletion recovery job is protected against duplicates'
)

check(
  deletionService.includes(
    "'account_deletion_retry'"
  ),
  'durable account deletion recovery job exists'
)

check(
  deletionService.includes(
    "'privacy.account_deleted'"
  ),
  'final account deletion audit preserved'
)

const finalAudit=
  deletionService.indexOf(
    "'privacy.account_deleted'"
  )

const finalTx=
  deletionService.lastIndexOf(
    'await tx(async client=>{',
    finalAudit
  )

check(
  finalTx>=0 &&
  finalTx<finalAudit,
  'final account deletion audit remains transactional'
)

check(
  deletionService.indexOf(
    '.subscriptions'
  ) <
  finalTx,
  'Stripe remains outside final DB transaction'
)

check(
  deletionService.indexOf(
    'deleteVerificationObject('
  ) <
  finalTx,
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
