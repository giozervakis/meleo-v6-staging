import { config, assertProductionReady } from './config.js'
import { migrate, tx, sql, closePool } from './relational/pool.js'
import { deliverEmail } from './mail.js'
import { log } from './logger.js'
import { observeJob, observeError } from './metrics.js'
import { redisSetJson, closeRedis } from './redis.js'
import {
  reconcileStripeSubscriptions,
  scheduleStripeReconciliation
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

async function claim(){
  return tx(async c=>{
    const {rows}=await c.query(`SELECT * FROM background_jobs WHERE status='pending' AND run_at<=now() ORDER BY priority ASC,created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1`)
    const job=rows[0]; if(!job)return null
    await c.query(`UPDATE background_jobs SET status='processing',locked_at=now(),locked_by=$2,attempts=attempts+1,updated_at=now() WHERE id=$1`,[job.id,workerId])
    job.attempts=Number(job.attempts)+1; return job
  })
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
async function run(job){
  active++
  try{
    await execute(job)
    await sql(`UPDATE background_jobs SET status='completed',locked_at=null,locked_by=null,last_error=null,completed_at=now(),updated_at=now() WHERE id=$1`,[job.id])
    observeJob('completed');log.info('job.completed',{jobId:job.id,type:job.job_type,attempt:job.attempts})
  }catch(err){
    const terminal=job.attempts>=Number(job.max_attempts||5)
    const delay=Math.min(3600,Math.pow(2,Math.max(0,job.attempts-1))*15)
    await sql(`UPDATE background_jobs SET status=$2,run_at=CASE WHEN $2='pending' THEN now()+($3||' seconds')::interval ELSE run_at END,locked_at=null,locked_by=null,last_error=$4,updated_at=now() WHERE id=$1`,[job.id,terminal?'failed':'pending',String(delay),String(err?.message||err).slice(0,2000)])
    observeJob(terminal?'failed':'retry');log.error(terminal?'job.dead_letter':'job.retry',{jobId:job.id,type:job.job_type,attempt:job.attempts,error:err.message,nextDelaySeconds:terminal?null:delay})
  }finally{active--}
}
async function recoverStale(){
  const r=await sql(`UPDATE background_jobs SET status='pending',locked_at=null,locked_by=null,run_at=now(),updated_at=now(),last_error=COALESCE(last_error,'') || ' [stale lock recovered]' WHERE status='processing' AND locked_at<now()-interval '10 minutes'`)
  if(r.rowCount)log.warn('job.stale_recovered',{count:r.rowCount})
}
process.on('SIGTERM',()=>{stopping=true});process.on('SIGINT',()=>{stopping=true})
await recoverStale()

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
  while(!stopping&&active<concurrency){const job=await claim();if(!job)break;run(job)}
  await new Promise(r=>setTimeout(r,pollMs))
}
while(active>0)await new Promise(r=>setTimeout(r,100))
await closeRedis();await closePool();log.info('worker.stopped',{workerId});process.exit(0)
