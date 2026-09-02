import fs from 'node:fs'

const failures=[]

function read(path){
  return fs.readFileSync(path,'utf8').replace(/^\uFEFF/,'')
}

function check(condition,message){
  if(condition){
    console.log('[PASS] ' + message)
    return
  }

  failures.push(message)
  console.error('[FAIL] ' + message)
}

const mail=read('server/mail.js')
const worker=read('server/worker.js')
const runtime=read('server/services/job-runtime.service.js')

check(
  mail.includes("reason: 'mail_not_configured'"),
  'mail provider-disabled state remains explicit'
)

check(
  worker.includes("job.job_type==='email'"),
  'email remains a durable worker job type'
)

check(
  worker.includes('await deliverEmail('),
  'worker uses canonical provider delivery'
)

check(
  worker.includes('!out.delivered'),
  'every queued delivery failure enters worker failure path'
)

check(
  !worker.includes("out.reason!=='mail_not_configured'"),
  'mail_not_configured is no longer silently completed'
)

check(
  worker.includes('throw new Error('),
  'failed queued email becomes runtime failure'
)

check(
  runtime.includes('attempts=attempts+1'),
  'email retry attempts inherit atomic runtime accounting'
)

check(
  runtime.includes('retryDelaySeconds'),
  'email retry inherits bounded backoff'
)

check(
  runtime.includes("'job.retry'"),
  'email retries remain observable'
)

check(
  runtime.includes("'job.dead_letter'"),
  'exhausted email retries become dead-letter failures'
)

check(
  runtime.includes(
    "const nextStatus="
  ) &&
  runtime.includes(
    "? 'failed'"
  ) &&
  runtime.includes(
    "status=$2"
  ) &&
  runtime.includes(
    "nextStatus"
  ),
  'terminal async failure has durable failed state'
)

check(
  mail.includes('maxAttempts:5'),
  'queued transactional email retains five-attempt budget'
)

console.log('')
console.log('D10H.3 SEMANTICS')
console.log('---------------')
console.log('Provider success -> job completed')
console.log('Provider failure -> retry/backoff')
console.log('Provider timeout -> retry/backoff')
console.log('Mail not configured -> retry/backoff')
console.log('Attempts exhausted -> dead-letter / failed')
console.log('Direct no-DB path -> existing explicit delivery result preserved')

if(failures.length){
  console.error('')
  console.error(
    'MELEO D10H.3 email retry reliability self-test: ' +
    failures.length +
    ' failure(s)'
  )
  process.exit(1)
}

console.log('')
console.log(
  'MELEO D10H.3 email retry / dead-letter reliability self-test: OK'
)
