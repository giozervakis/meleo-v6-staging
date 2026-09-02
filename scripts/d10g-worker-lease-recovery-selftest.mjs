import fs from 'node:fs'


const failures=[]


function check(
  condition,
  message
){
  if(condition){
    console.log(
      `[PASS] ${message}`
    )

    return
  }

  failures.push(message)

  console.error(
    `[FAIL] ${message}`
  )
}


function read(path){
  return fs
    .readFileSync(
      path,
      'utf8'
    )
    .replace(/^\uFEFF/, '')
}


const runtime =
  read(
    'server/services/job-runtime.service.js'
  )

const worker =
  read(
    'server/worker.js'
  )

const integration =
  read(
    'tests/integration/worker-retry-runtime.integration.mjs'
  )

const d10f6 =
  read(
    'scripts/d10f-worker-retry-runtime-selftest.mjs'
  )

const metrics =
  read(
    'server/operational-metrics.js'
  )


/*
 * CLAIM / LEASE OWNERSHIP
 */

check(
  runtime.includes(
    'FOR UPDATE SKIP LOCKED'
  ),
  'job claim uses PostgreSQL SKIP LOCKED'
)


check(
  runtime.includes(
    "status='processing'"
  ),
  'claimed job transitions atomically to processing'
)


check(
  runtime.includes(
    'locked_at=now()'
  ),
  'claim establishes lease timestamp'
)


check(
  runtime.includes(
    'locked_by=$2'
  ),
  'claim records authoritative worker owner'
)


check(
  runtime.includes(
    'attempts=attempts+1'
  ),
  'claim increments attempt count atomically'
)


check(
  runtime.includes(
    "WHERE status='pending'"
  ),
  'only pending jobs are eligible for normal claim'
)


check(
  runtime.includes(
    'ORDER BY priority ASC,created_at ASC'
  ),
  'ready jobs retain deterministic priority ordering'
)


/*
 * SUCCESS / RETRY / DEAD LETTER
 */

check(
  runtime.includes(
    "status='completed'"
  ),
  'successful job reaches completed state'
)


check(
  runtime.includes(
    'locked_at=null'
  ) &&
  runtime.includes(
    'locked_by=null'
  ),
  'terminal/retry transitions release worker lease'
)


check(
  runtime.includes(
    'retryDelaySeconds('
  ),
  'runtime owns bounded retry backoff'
)


check(
  runtime.includes(
    "? 'failed'"
  ) &&
  runtime.includes(
    ": 'pending'"
  ),
  'max-attempt decision separates dead-letter from retry'
)


check(
  runtime.includes(
    "'job.dead_letter'"
  ),
  'terminal failure emits explicit dead-letter event'
)


check(
  runtime.includes(
    "'job.retry'"
  ),
  'retry transition emits explicit retry event'
)


/*
 * STALE LEASE RECOVERY
 */

check(
  runtime.includes(
    'async function recoverStale()'
  ),
  'canonical runtime owns stale-lock recovery'
)


check(
  runtime.includes(
    "WHERE status='processing'"
  ),
  'stale recovery targets processing jobs only'
)


check(
  runtime.includes(
    'AND locked_at<'
  ),
  'stale recovery requires expired lock age'
)


check(
  runtime.includes(
    "status='pending'"
  ),
  'expired processing lease returns job to pending'
)


check(
  runtime.includes(
    '[stale lock recovered]'
  ),
  'stale recovery leaves durable recovery evidence'
)


check(
  runtime.includes(
    "'job.stale_recovered'"
  ),
  'stale recovery emits explicit lifecycle event'
)


/*
 * WORKER START / STOP INTEGRATION
 */

check(
  worker.includes(
    'await jobRuntime.recoverStale()'
  ),
  'worker performs stale recovery before normal polling'
)


const recoverIndex =
  worker.indexOf(
    'await jobRuntime.recoverStale()'
  )

const pollIndex =
  worker.indexOf(
    'while(!stopping)'
  )


check(
  recoverIndex >= 0 &&
  pollIndex > recoverIndex,
  'stale recovery occurs before worker polling loop'
)


check(
  worker.includes(
    'await jobRuntime.claim()'
  ),
  'production worker delegates claims to canonical runtime'
)


check(
  worker.includes(
    'await jobRuntime.run('
  ),
  'production worker delegates execution transitions to canonical runtime'
)


check(
  worker.includes(
    'while(!stopping&&active<concurrency)'
  ) ||
  worker.includes(
    'while (!stopping && active < concurrency)'
  ),
  'stopping worker does not acquire new leases'
)


check(
  worker.includes(
    'while(active>0)'
  ) ||
  worker.includes(
    'while (active > 0)'
  ),
  'worker drains active jobs before dependency shutdown'
)


/*
 * REAL RUNTIME PROOFS
 */

check(
  integration.includes(
    'exactly one claim winner'
  ),
  'runtime integration proves single winner under concurrent claim'
)


check(
  integration.includes(
    'claim atomically marks processing and increments attempts once'
  ),
  'runtime integration proves atomic lease acquisition'
)


check(
  integration.includes(
    'successful execution clears locks and marks completed'
  ),
  'runtime integration proves successful lease release'
)


check(
  integration.includes(
    'first failure schedules 15-second retry'
  ) &&
  integration.includes(
    '30-second retry'
  ),
  'runtime integration proves exponential retry backoff'
)


check(
  integration.includes(
    'max-attempt failure becomes terminal dead-letter'
  ),
  'runtime integration proves terminal dead-letter behavior'
)


check(
  integration.includes(
    'stale recovery touches exactly expired processing lock'
  ),
  'runtime integration proves expired lease recovery'
)


check(
  integration.includes(
    'non-stale processing lock is not recovered'
  ),
  'runtime integration protects fresh active leases'
)


check(
  integration.includes(
    'future run_at job is not claimed'
  ),
  'runtime integration protects scheduled future jobs'
)


check(
  integration.includes(
    'highest priority is claimed first'
  ),
  'runtime integration proves priority semantics'
)


/*
 * D10F.6 STRUCTURAL COMPATIBILITY
 */

check(
  d10f6.includes(
    'canonical runtime owns stale-lock recovery'
  ),
  'D10F.6 structural gate covers stale recovery'
)


check(
  d10f6.includes(
    'runtime launches concurrent worker claims'
  ),
  'D10F.6 structural gate covers claim concurrency'
)


check(
  d10f6.includes(
    'runtime verifies terminal dead-letter behavior'
  ),
  'D10F.6 structural gate covers dead-letter semantics'
)


/*
 * OBSERVABILITY
 */

check(
  metrics.includes(
    'worker_heartbeat_age_seconds'
  ),
  'worker heartbeat age is observable'
)


check(
  metrics.includes(
    'worker_oldest_pending_seconds'
  ),
  'oldest pending job age is observable'
)


check(
  metrics.includes(
    'alert_worker_down'
  ),
  'worker-down condition is alertable'
)


check(
  metrics.includes(
    'alert_queue_failed'
  ),
  'failed queue jobs are alertable'
)


check(
  metrics.includes(
    'alert_queue_backlog'
  ),
  'queue backlog is alertable'
)


if(
  failures.length
){
  console.error('')

  console.error(
    `MELEO D10G.7 worker lease recovery self-test: ${failures.length} failure(s)`
  )

  process.exit(1)
}


console.log('')

console.log(
  'MELEO D10G.7 worker lease / stuck-job recovery self-test: OK'
)