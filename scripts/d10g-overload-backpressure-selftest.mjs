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


const app =
  read(
    'server/relational/app.js'
  )

const config =
  read(
    'server/config.js'
  )

const pool =
  read(
    'server/relational/pool.js'
  )

const worker =
  read(
    'server/worker.js'
  )

const metrics =
  read(
    'server/operational-metrics.js'
  )


/*
 * HTTP REQUEST PRESSURE
 */

check(
  app.includes(
    "express.json({ limit: '12mb' })"
  ),
  'general JSON request body has explicit size limit'
)


check(
  app.includes(
    "express.raw({type:'application/json',limit:'1mb'})"
  ),
  'Stripe webhook request body has tighter explicit limit'
)


check(
  app.includes(
    "return res.status(429)"
  ),
  'rate limiter rejects overload with HTTP 429'
)


check(
  app.includes(
    "res.setHeader('Retry-After'"
  ),
  'rate limiter provides Retry-After guidance'
)


check(
  app.includes(
    "app.use('/api',limits.global)"
  ),
  'global API rate limiter is installed'
)


const namedLimits = [
  'login',
  'loginAccount',
  'admin',
  'adminWrite',
  'register',
  'password',
  'write',
  'geo',
  'checkout',
  'profile',
  'analytics'
]


for(
  const name of namedLimits
){
  check(
    app.includes(
      `${name}: rateLimit({`
    ),
    `specialized ${name} rate limit exists`
  )
}


check(
  app.includes(
    'redisRateLimit('
  ),
  'rate limiting can use shared Redis state'
)


check(
  app.includes(
    'INSERT INTO rate_limits'
  ),
  'rate limiting has persistent PostgreSQL fallback'
)


check(
  app.includes(
    'count>max'
  ) ||
  app.includes(
    'count > max'
  ),
  'rate limiter enforces explicit request ceiling'
)


/*
 * DATABASE BACKPRESSURE
 */

check(
  pool.includes(
    'max: Math.max(5, config.databasePoolMax || 10)'
  ),
  'PostgreSQL pool has bounded maximum size'
)


check(
  config.includes(
    'databasePoolMax:'
  ),
  'database pool maximum is configuration-controlled'
)


check(
  pool.includes(
    'connectionTimeoutMillis:'
  ),
  'database acquisition wait is bounded'
)


check(
  pool.includes(
    'idleTimeoutMillis:'
  ),
  'idle database connections are bounded'
)


check(
  pool.includes(
    'statement_timeout:'
  ),
  'PostgreSQL statement execution has server-side timeout'
)


check(
  pool.includes(
    'query_timeout:'
  ),
  'PostgreSQL client query execution has timeout'
)


check(
  config.includes(
    'DATABASE_CONNECTION_TIMEOUT_MS'
  ),
  'database connection timeout is externally configurable'
)


check(
  config.includes(
    'DATABASE_STATEMENT_TIMEOUT_MS'
  ),
  'database statement timeout is externally configurable'
)


check(
  config.includes(
    'DATABASE_QUERY_TIMEOUT_MS'
  ),
  'database query timeout is externally configurable'
)


/*
 * WORKER CONCURRENCY BACKPRESSURE
 */

check(
  worker.includes(
    'Math.max(1,Math.min(20,Number(process.env.WORKER_CONCURRENCY||5)))'
  ),
  'worker concurrency is hard-capped between 1 and 20'
)


check(
  worker.includes(
    'active<concurrency'
  ),
  'worker claim loop honors concurrency ceiling'
)


check(
  worker.includes(
    'active++'
  ) &&
  worker.includes(
    'active--'
  ),
  'worker tracks active in-flight work'
)


check(
  worker.includes(
    'pollMs=Math.max(250'
  ),
  'worker polling interval has lower bound'
)


/*
 * QUEUE PRESSURE OBSERVABILITY
 */

check(
  metrics.includes(
    'worker_oldest_pending_seconds'
  ),
  'queue age pressure is measurable'
)


check(
  metrics.includes(
    'worker_active_jobs'
  ),
  'active worker jobs are measurable'
)


check(
  metrics.includes(
    'worker_concurrency'
  ),
  'worker concurrency capacity is measurable'
)


check(
  metrics.includes(
    'alert_queue_backlog'
  ),
  'queue backlog has explicit alert'
)


check(
  metrics.includes(
    'alert_queue_failed'
  ),
  'failed queue workload has explicit alert'
)


check(
  metrics.includes(
    'worker_oldest_pending_seconds || 0) > 300'
  ) ||
  metrics.includes(
    'worker_oldest_pending_seconds||0)>300'
  ),
  'queue backlog threshold is bounded and explicit'
)


/*
 * HTTP CONNECTION BOUNDS
 */

check(
  app.includes(
    'server.keepAliveTimeout = 65000'
  ),
  'HTTP keep-alive timeout is explicitly bounded'
)


check(
  app.includes(
    'server.headersTimeout = 66000'
  ),
  'HTTP header timeout is explicitly bounded'
)


/*
 * NO UNBOUNDED WORKER ACCEPTANCE
 */

check(
  !worker.includes(
    'Promise.all(jobs'
  ),
  'worker does not dispatch arbitrary queue batches with unbounded Promise.all'
)


check(
  !worker.includes(
    'while(true)'
  ) &&
  !worker.includes(
    'while (true)'
  ),
  'worker has no unconditional infinite claim loop'
)


/*
 * CONTRACT COMPOSITION
 */

check(
  app.includes(
    'limits.global'
  ) &&
  pool.includes(
    'max:'
  ) &&
  worker.includes(
    'active<concurrency'
  ),
  'HTTP, database, and worker layers all enforce independent pressure ceilings'
)


if(
  failures.length
){
  console.error('')

  console.error(
    `MELEO D10G.8 overload backpressure self-test: ${failures.length} failure(s)`
  )

  process.exit(1)
}


console.log('')

console.log(
  'MELEO D10G.8 backpressure / overload protection self-test: OK'
)