import { config, assertProductionReady } from './config.js'
import {
  migrate,
  tx,
  sql,
  many,
  id,
  now,
  closePool
} from './relational/pool.js'
import {
  Users,
  Professionals,
  audit
} from './relational/repositories.js'
import {
  deleteVerificationObject
} from './object-storage.js'
import {
  deliverEmail,
  mail
} from './mail.js'
import {
  createAccountDeletionService
} from './services/account-deletion.service.js'
import { log } from './logger.js'
import { observeJob, observeError } from './metrics.js'
import { createJobRuntime } from './services/job-runtime.service.js'
import { redisSetJson, closeRedis } from './redis.js'
import {
  reconcileStripeSubscriptions,
  scheduleStripeReconciliation,
  getReconciliationStripe
} from './stripe-reconciliation.js'

assertProductionReady()
await migrate()
const workerId=process.env.WORKER_ID||process.env.HOSTNAME||`worker-${process.pid}`
const concurrency=Math.max(1,Math.min(20,Number(process.env.WORKER_CONCURRENCY||5)))
const pollMs=Math.max(250,Number(process.env.WORKER_POLL_MS||1000))
const stripeReconcileIntervalSeconds=Math.max(
  300,
  Number(
    process.env.STRIPE_RECONCILE_INTERVAL_SECONDS||
    3600
  )
)
let stopping=false, active=0

const accountDeletion=
  createAccountDeletionService({
    Users,
    Professionals,
    many,
    tx,
    audit,
    deleteVerificationObject,
    getStripe:
      getReconciliationStripe,
    now,
    id
  })

const heartbeatKey='meleo:observability:worker:heartbeat'
const heartbeatTtlSeconds=30
let lastHeartbeatAt=0

async function publishHeartbeat(force=false){
  const current=Date.now()
  if(!force&&current-lastHeartbeatAt<5000)return
  lastHeartbeatAt=current
  try{
    await redisSetJson(
      heartbeatKey,
      {ts:new Date(current).toISOString(),workerId,active,concurrency},
      heartbeatTtlSeconds
    )
  }catch{
    observeError('redis','worker_heartbeat_failed')
  }
}

async function execute(job){
  if(job.job_type==='email'){
    const out=
      await deliverEmail(
        job.payload
      )

    if(
      !out.delivered&&
      out.reason!=='mail_not_configured'
    ){
      throw new Error(
        out.reason||
        'email delivery failed'
      )
    }

    return
  }

  if(
    job.job_type===
    'account_deletion_retry'
  ){
    const userId=
      String(
        job.payload?.userId ||
        ''
      )

    if(!userId){
      throw new Error(
        'account_deletion_retry missing userId'
      )
    }

    const result=
      await accountDeletion.retry(
        userId
      )

    /*
     * Email remains post-commit and outside the account-deletion DB
     * transaction. D10H owns broader transactional-mail reliability.
     */
    if(
      result.deleted &&
      !result.alreadyDeleted &&
      result.email
    ){
      await mail.accountDeleted(
        result.email,
        result.name
      )
    }

    return
  }

  if(
    job.job_type===
    'stripe_reconcile'
  ){
    const summary=
      await reconcileStripeSubscriptions({
        limit:
          Number(
            job.payload?.limit||
            process.env.STRIPE_RECONCILE_LIMIT||
            500
          )
      })

    log.info(
      'job.stripe_reconcile.completed',
      {
        jobId:job.id,
        ...summary
      }
    )

    /*
     * Self-schedule the next run.
     *
     * scheduleStripeReconciliation()
     * prevents duplicate pending/processing
     * reconciliation jobs.
     */
    await scheduleStripeReconciliation({
      delaySeconds:
        stripeReconcileIntervalSeconds,

      reason:
        'periodic'
    })

    return
  }

  throw new Error(
    `Unknown job type: ${job.job_type}`
  )
}

const jobRuntime=
  createJobRuntime({
    tx,
    sql,
    execute,
    observeJob,
    log,
    workerId
  })

async function runJob(job){
  active++

  try{
    await jobRuntime.run(
      job
    )
  }
  finally{
    active--
  }
}
process.on('SIGTERM',()=>{stopping=true});process.on('SIGINT',()=>{stopping=true})
await jobRuntime.recoverStale()

await scheduleStripeReconciliation({
  delaySeconds:5,
  reason:'worker_start'
}).catch(
  err=>
    log.error(
      'stripe.reconcile.bootstrap_failed',
      {
        message:
          err?.message||
          String(err)
      }
    )
)

await publishHeartbeat(true)

log.info(
  'worker.started',
  {
    workerId,
    concurrency,
    pollMs,
    stripeReconcileIntervalSeconds
  }
)
while(!stopping){
  await publishHeartbeat()
  while(!stopping&&active<concurrency){const job=await jobRuntime.claim();if(!job)break;runJob(job)}
  await new Promise(r=>setTimeout(r,pollMs))
}
while(active>0)await new Promise(r=>setTimeout(r,100))
await closeRedis();await closePool();log.info('worker.stopped',{workerId});process.exit(0)
