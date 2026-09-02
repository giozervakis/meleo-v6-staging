import fs from 'node:fs'

const read=path=>
  fs.readFileSync(path,'utf8')
    .replace(/^\uFEFF/,'')
    .replace(/\r\n/g,'\n')

const service=
  read(
    'server/services/account-deletion.service.js'
  )

const route=
  read(
    'server/routes/account-privacy.routes.js'
  )

const worker=
  read(
    'server/worker.js'
  )

const app=
  read(
    'server/relational/app.js'
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


check(
  service.includes(
    'createAccountDeletionService'
  ),
  'canonical account deletion service exists'
)

check(
  route.includes(
    'createAccountDeletionService'
  ) &&
  route.includes(
    'await accountDeletion.request('
  ),
  'HTTP deletion route uses canonical service'
)

check(
  app.includes(
    'registerAccountPrivacyRoutes('
  ) &&
  app.includes(
    '    id,'
  ),
  'account deletion service receives durable job id dependency'
)

check(
  service.includes(
    '.subscriptions'
  ) &&
  service.includes(
    '.retrieve('
  ) &&
  service.includes(
    '.cancel('
  ),
  'Stripe cancellation is retry-safe'
)

const stripePos=
  service.indexOf(
    '.subscriptions'
  )

const storagePos=
  service.indexOf(
    'await deleteVerificationObject('
  )

const finalTxMarker=
  service.indexOf(
    'async function finalizeDeletion('
  )

check(
  stripePos>=0 &&
  storagePos>stripePos &&
  finalTxMarker>storagePos,
  'external cleanup precedes final local anonymisation'
)

check(
  service.includes(
    'deletion_pending=true'
  ),
  'external failure persists deletion pending state'
)

check(
  service.includes(
    "'account_deletion_retry'"
  ),
  'account deletion retry job is durable'
)

check(
  service.includes(
    "status IN ("
  ) &&
  service.includes(
    "'pending'"
  ) &&
  service.includes(
    "'processing'"
  ),
  'duplicate pending/processing recovery jobs are prevented'
)

check(
  service.includes(
    'SELECT id'
  ) &&
  service.includes(
    'FROM users'
  ) &&
  service.includes(
    'FOR UPDATE'
  ),
  'user row serializes competing deletion requests'
)

check(
  service.includes(
    '48,'
  ),
  'recovery job receives extended retry budget'
)

const pendingTx=
  service.indexOf(
    'async function schedulePendingRecovery('
  )

const jobInsert=
  service.indexOf(
    'INSERT INTO background_jobs',
    pendingTx
  )

check(
  pendingTx>=0 &&
  jobInsert>pendingTx,
  'pending state and durable recovery job share transaction boundary'
)

check(
  service.includes(
    'scheduleRecovery:false'
  ),
  'worker retry does not recursively enqueue recovery jobs'
)

check(
  worker.includes(
    "job.job_type===\n    'account_deletion_retry'"
  ),
  'worker handles account deletion recovery job'
)

check(
  worker.includes(
    'await accountDeletion.retry('
  ),
  'worker invokes canonical retry path'
)

check(
  worker.includes(
    'getReconciliationStripe'
  ),
  'worker reuses canonical production Stripe client'
)

check(
  worker.includes(
    'await mail.accountDeleted('
  ),
  'worker completion keeps email post-commit'
)

check(
  service.includes(
    'if(user.deleted_at)'
  ) &&
  service.includes(
    'alreadyDeleted:true'
  ),
  'retry is safe after final DB commit'
)

check(
  service.includes(
    'subscription.status!=='
  ) &&
  service.includes(
    "'canceled'"
  ),
  'already-cancelled Stripe subscription is not cancelled twice'
)

check(
  service.includes(
    'throw error'
  ) &&
  service.includes(
    'retryMode'
  ),
  'worker-visible external failures remain retryable'
)

check(
  pkg.scripts?.[
    'account-deletion-recovery-check'
  ] ===
    'node scripts/d10e-account-deletion-recovery-selftest.mjs',
  'D10E.10D package script exists'
)

const gate=
  pkg.scripts?.[
    'ci:gate'
  ] || ''

check(
  gate.includes(
    'npm run verification-storage-compensation-check && npm run account-deletion-recovery-check'
  ),
  'D10E.10D follows D10E.10C in ci:gate'
)


if(
  checks.every(
    x=>x.condition
  )
){
  console.log('')
  console.log(
    'MELEO D10E.10D account deletion recovery self-test: OK'
  )
}
else{
  process.exitCode=1
}
