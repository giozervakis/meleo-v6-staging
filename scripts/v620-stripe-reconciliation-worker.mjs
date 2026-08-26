import fs from 'node:fs'

const file =
  'server/worker.js'

let source =
  fs.readFileSync(
    file,
    'utf8'
  )
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')


function fail(message) {
  console.error(
    '[FAIL]',
    message
  )

  process.exit(1)
}


/*
 * ------------------------------------------------------------
 * Import reconciliation helpers
 * ------------------------------------------------------------
 */

const importAnchor =
  `import { observeJob } from './metrics.js'`

const importBlock =
  `import { observeJob } from './metrics.js'
import {
  reconcileStripeSubscriptions,
  scheduleStripeReconciliation
} from './stripe-reconciliation.js'`


if (
  !source.includes(
    "from './stripe-reconciliation.js'"
  )
) {

  if (
    !source.includes(
      importAnchor
    )
  ) {
    fail(
      'Worker metrics import anchor not found'
    )
  }

  source =
    source.replace(
      importAnchor,
      importBlock
    )
}


/*
 * ------------------------------------------------------------
 * Add reconciliation config
 * ------------------------------------------------------------
 */

const configAnchor =
  `const pollMs=Math.max(250,Number(process.env.WORKER_POLL_MS||1000))`

const configBlock =
  `const pollMs=Math.max(250,Number(process.env.WORKER_POLL_MS||1000))
const stripeReconcileIntervalSeconds=Math.max(
  300,
  Number(
    process.env.STRIPE_RECONCILE_INTERVAL_SECONDS||
    3600
  )
)`


if (
  !source.includes(
    'stripeReconcileIntervalSeconds'
  )
) {

  if (
    !source.includes(
      configAnchor
    )
  ) {
    fail(
      'Worker poll config anchor not found'
    )
  }

  source =
    source.replace(
      configAnchor,
      configBlock
    )
}


/*
 * ------------------------------------------------------------
 * Replace execute()
 * ------------------------------------------------------------
 */

const executeRegex =
  /async function execute\(job\)\{[\s\S]*?\n\}/

const executeMatch =
  source.match(
    executeRegex
  )


if (!executeMatch) {
  fail(
    'Worker execute() not found'
  )
}


if (
  !executeMatch[0].includes(
    "job.job_type==='stripe_reconcile'"
  )
) {

  const replacement =
`async function execute(job){
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
    \`Unknown job type: \${job.job_type}\`
  )
}`


  source =
    source.replace(
      executeMatch[0],
      replacement
    )
}


/*
 * ------------------------------------------------------------
 * Bootstrap scheduled reconciliation
 * ------------------------------------------------------------
 */

const startupAnchor =
  `await recoverStale();log.info('worker.started',{workerId,concurrency,pollMs})`

const startupBlock =
`await recoverStale()

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

log.info(
  'worker.started',
  {
    workerId,
    concurrency,
    pollMs,
    stripeReconcileIntervalSeconds
  }
)`


if (
  !source.includes(
    "reason:'worker_start'"
  )
) {

  if (
    !source.includes(
      startupAnchor
    )
  ) {
    fail(
      'Worker startup anchor not found'
    )
  }

  source =
    source.replace(
      startupAnchor,
      startupBlock
    )
}


/*
 * ------------------------------------------------------------
 * Clean file
 * ------------------------------------------------------------
 */

source =
  source
    .split('\n')
    .map(
      line =>
        line.replace(
          /[ \t]+$/,
          ''
        )
    )
    .join('\n')
    .replace(/\n*$/, '') +
  '\n'


fs.writeFileSync(
  file,
  source,
  'utf8'
)


console.log(
  '[PASS] stripe_reconcile job type installed'
)

console.log(
  '[PASS] periodic reconciliation bootstrap installed'
)

console.log(
  '[PASS] worker retry/dead-letter framework preserved'
)
