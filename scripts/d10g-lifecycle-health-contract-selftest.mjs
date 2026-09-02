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


const lifecycle =
  read(
    'server/routes/lifecycle.routes.js'
  )

const system =
  read(
    'server/routes/system.routes.js'
  )

const app =
  read(
    'server/relational/app.js'
  )

const metrics =
  read(
    'server/operational-metrics.js'
  )

const readiness =
  read(
    'scripts/d10g-readiness-criticality-selftest.mjs'
  )

const render =
  fs.existsSync(
    'render.yaml'
  )
    ? read('render.yaml')
    : ''


/*
 * ROUTE OWNERSHIP
 */

check(
  lifecycle.includes(
    "app.get('/api/liveness'"
  ),
  'lifecycle module owns /api/liveness'
)


check(
  lifecycle.includes(
    "app.get('/api/ready'"
  ),
  'lifecycle module owns /api/ready'
)


check(
  system.includes(
    "'/api/health'"
  ) ||
  system.includes(
    '"/api/health"'
  ),
  'system module owns /api/health'
)


check(
  !system.includes(
    "'/api/ready'"
  ) &&
  !system.includes(
    '"/api/ready"'
  ),
  'system module does not duplicate readiness route'
)


check(
  !system.includes(
    "'/api/liveness'"
  ) &&
  !system.includes(
    '"/api/liveness"'
  ),
  'system module does not duplicate liveness route'
)


/*
 * LIVENESS CONTRACT
 */

check(
  lifecycle.includes(
    "state:'live'"
  ) ||
  lifecycle.includes(
    "state: 'live'"
  ),
  'liveness exposes live process state'
)


const livenessStart =
  lifecycle.indexOf(
    "app.get('/api/liveness'"
  )

const readinessStart =
  lifecycle.indexOf(
    "app.get('/api/ready'"
  )

const livenessBlock =
  livenessStart >= 0 &&
  readinessStart > livenessStart
    ? lifecycle.slice(
        livenessStart,
        readinessStart
      )
    : ''


check(
  livenessBlock.length > 0,
  'liveness route block is structurally isolated'
)


check(
  !livenessBlock.includes(
    'collectOperationalMetrics'
  ),
  'liveness does not depend on external dependency probes'
)


check(
  !livenessBlock.includes(
    'redisPing'
  ) &&
  !livenessBlock.includes(
    'storageReady'
  ),
  'liveness remains dependency-independent'
)


/*
 * READINESS CONTRACT
 */

check(
  lifecycle.includes(
    'collectOperationalMetrics()'
  ),
  'readiness consumes operational dependency metrics'
)


check(
  lifecycle.includes(
    'await storageReady()'
  ),
  'readiness probes object storage'
)


check(
  lifecycle.includes(
    "criticalFailures.push('database')"
  ),
  'database remains readiness-critical'
)


check(
  lifecycle.includes(
    "criticalFailures.push('redis')"
  ),
  'required Redis can make readiness fail'
)


check(
  lifecycle.includes(
    "criticalFailures.push('worker')"
  ),
  'required worker can make readiness fail'
)


check(
  lifecycle.includes(
    "criticalFailures.push(") &&
  lifecycle.includes(
    "'admin2fa'"
  ),
  'production admin 2FA remains readiness-critical'
)


check(
  lifecycle.includes(
    "degradedCapabilities.push(") &&
  lifecycle.includes(
    "'objectStorage'"
  ),
  'object storage degradation is represented explicitly'
)


check(
  lifecycle.includes(
    "'payments'"
  ),
  'payments degradation is represented explicitly'
)


check(
  lifecycle.includes(
    "'mail'"
  ),
  'mail degradation is represented explicitly'
)


check(
  lifecycle.includes(
    ".status(503)"
  ),
  'readiness has explicit HTTP 503 failure path'
)


check(
  lifecycle.includes(
    "state:'draining'"
  ) ||
  lifecycle.includes(
    "state: 'draining'"
  ),
  'draining process is not ready'
)


check(
  /state\s*:\s*degraded\s*\?\s*'degraded'\s*:\s*'ready'/s.test(
    lifecycle
  ),
  'healthy/degraded readiness state contract is explicit'
)


/*
 * OPERATIONAL PROBES
 */

check(
  metrics.includes(
    'postgres_operational_up'
  ),
  'operational metrics expose PostgreSQL health'
)


check(
  metrics.includes(
    'redis_up'
  ),
  'operational metrics expose Redis health'
)


check(
  metrics.includes(
    'worker_up'
  ),
  'operational metrics expose worker health'
)


check(
  metrics.includes(
    'WORKER_HEARTBEAT_FRESH_SECONDS'
  ),
  'worker readiness is heartbeat freshness based'
)


/*
 * APPLICATION REGISTRATION
 */

check(
  app.includes(
    'registerSystemRoutes('
  ),
  'system health routes are registered'
)


check(
  app.includes(
    'registerLifecycleRoutes('
  ),
  'lifecycle routes are registered'
)


check(
  app.includes(
    'getShuttingDown:()=>shuttingDown'
  ) ||
  app.includes(
    'getShuttingDown: () => shuttingDown'
  ),
  'readiness receives live shutdown state'
)


/*
 * EXISTING BEHAVIORAL COVERAGE
 */

check(
  readiness.includes(
    'healthy readiness returns HTTP 200'
  ),
  'D10G.1 covers healthy readiness'
)


check(
  readiness.includes(
    'PostgreSQL failure returns HTTP 503'
  ),
  'D10G.1 covers database readiness failure'
)


check(
  readiness.includes(
    'optional Redis failure preserves HTTP 200'
  ),
  'D10G.1 covers degraded optional dependency'
)


check(
  readiness.includes(
    'draining process returns HTTP 503'
  ),
  'D10G.1 covers draining readiness failure'
)


/*
 * DEPLOYMENT HEALTH TARGET
 */

if(render){
  check(
    render.includes(
      'healthCheckPath: /api/ready'
    ),
    'Render health check targets readiness, not basic health'
  )
}


if(
  failures.length
){
  console.error('')

  console.error(
    `MELEO D10G.5 lifecycle health contract self-test: ${failures.length} failure(s)`
  )

  process.exit(1)
}


console.log('')

console.log(
  'MELEO D10G.5 lifecycle health contract self-test: OK'
)