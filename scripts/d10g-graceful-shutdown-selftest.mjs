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

const liveEventRuntime =
  read(
    'server/services/live-event-runtime.service.js'
  )

const worker =
  read(
    'server/worker.js'
  )

const lifecycle =
  read(
    'server/routes/lifecycle.routes.js'
  )

const redis =
  read(
    'server/redis.js'
  )

const pool =
  read(
    'server/relational/pool.js'
  )


const shutdownStart =
  app.indexOf(
    'async function shutdown('
  )

const signalStart =
  app.indexOf(
    "process.on("
  )

const shutdownBlock =
  shutdownStart >= 0 &&
  signalStart > shutdownStart
    ? app.slice(
        shutdownStart,
        signalStart
      )
    : ''


check(
  shutdownBlock.length > 0,
  'API graceful shutdown function exists'
)


check(
  shutdownBlock.includes(
    'if(shuttingDown) return'
  ) ||
  shutdownBlock.includes(
    'if (shuttingDown) return'
  ),
  'shutdown is idempotent against duplicate signals'
)


check(
  shutdownBlock.includes(
    'shuttingDown=true'
  ) ||
  shutdownBlock.includes(
    'shuttingDown = true'
  ),
  'shutdown marks instance draining immediately'
)


check(
  shutdownBlock.includes(
    'shutdownStartedAt='
  ) ||
  shutdownBlock.includes(
    'shutdownStartedAt ='
  ),
  'shutdown records drain start timestamp'
)


check(
  lifecycle.includes(
    'if(shuttingDown)'
  ) ||
  lifecycle.includes(
    'if (shuttingDown)'
  ),
  'readiness observes shutdown state'
)


check(
  lifecycle.includes(
    "state:'draining'"
  ) ||
  lifecycle.includes(
    "state: 'draining'"
  ),
  'draining state is externally visible'
)


check(
  lifecycle.includes(
    'res.status(503)'
  ) ||
  lifecycle.includes(
    '.status(503)'
  ),
  'draining instance becomes unready with HTTP 503'
)


const idxMark =
  Math.max(
    shutdownBlock.indexOf(
      'shuttingDown=true'
    ),
    shutdownBlock.indexOf(
      'shuttingDown = true'
    )
  )

const idxServerClose =
  shutdownBlock.indexOf(
    'server.close('
  )

/*
 * The SSE implementation may live directly in app.js
 * or in the extracted live-event runtime service.
 *
 * Ordering is still asserted from the composition root:
 * closeClients() must occur after server.close() begins,
 * and closeListener() must occur before Redis/PG shutdown.
 */
const hasSseShutdownEvent =
  shutdownBlock.includes(
    'event: shutdown'
  ) ||
  liveEventRuntime.includes(
    'event: shutdown'
  )

const idxSse =
  shutdownBlock.includes(
    'event: shutdown'
  )
    ? shutdownBlock.indexOf(
        'event: shutdown'
      )
    : shutdownBlock.indexOf(
        'liveEventRuntime.closeClients()'
      )

const idxIdle =
  shutdownBlock.indexOf(
    'closeIdleConnections'
  )

const hasUnlisten =
  shutdownBlock.includes(
    'UNLISTEN meleo_live'
  ) ||
  liveEventRuntime.includes(
    'UNLISTEN meleo_live'
  )

const idxUnlisten =
  shutdownBlock.includes(
    'UNLISTEN meleo_live'
  )
    ? shutdownBlock.indexOf(
        'UNLISTEN meleo_live'
      )
    : shutdownBlock.indexOf(
        'await liveEventRuntime.closeListener()'
      )

const idxRedis =
  shutdownBlock.indexOf(
    'await closeRedis()'
  )

const idxPool =
  shutdownBlock.indexOf(
    'await closePool()'
  )


check(
  idxMark >= 0 &&
  idxServerClose > idxMark,
  'instance becomes unready before HTTP listener drain'
)


check(
  idxServerClose >= 0,
  'HTTP server stops accepting new connections'
)


check(
  hasSseShutdownEvent &&
  idxSse >= 0,
  'SSE clients receive explicit shutdown event'
)


check(
  idxSse > idxServerClose,
  'SSE connections are closed after listener drain begins'
)


check(
  idxIdle >= 0,
  'idle HTTP connections are explicitly closed'
)


check(
  hasUnlisten &&
  idxUnlisten >= 0,
  'PostgreSQL live-event listener is unregistered'
)


check(
  idxRedis >= 0,
  'Redis connection is closed during shutdown'
)


check(
  idxPool >= 0,
  'PostgreSQL pool is closed during shutdown'
)


check(
  idxUnlisten < idxRedis &&
  idxRedis < idxPool,
  'dependency shutdown order is LISTEN cleanup -> Redis -> PostgreSQL'
)


check(
  shutdownBlock.includes(
    'forceTimer'
  ) &&
  shutdownBlock.includes(
    'setTimeout('
  ),
  'shutdown has bounded forced-exit safety timer'
)


check(
  shutdownBlock.includes(
    'forceTimer.unref()'
  ),
  'forced-exit timer does not keep process alive'
)


check(
  shutdownBlock.includes(
    'clearTimeout(forceTimer)'
  ),
  'forced-exit timer is cleared after graceful completion'
)


check(
  app.includes(
    "'SIGTERM'"
  ),
  'API handles SIGTERM'
)


check(
  app.includes(
    "'SIGINT'"
  ),
  'API handles SIGINT'
)


check(
  redis.includes(
    "await rawCommand(['QUIT'])"
  ),
  'Redis shutdown attempts protocol-level QUIT'
)


check(
  redis.includes(
    'socket.end()'
  ),
  'Redis socket is ended after QUIT'
)


check(
  pool.includes(
    'await pool.end()'
  ),
  'PostgreSQL pool waits for pool shutdown'
)


/*
 * WORKER SHUTDOWN
 */

check(
  worker.includes(
    'let stopping=false'
  ) ||
  worker.includes(
    'let stopping = false'
  ),
  'worker has explicit stopping state'
)


check(
  worker.includes(
    "process.on('SIGTERM'"
  ),
  'worker handles SIGTERM'
)


check(
  worker.includes(
    "process.on('SIGINT'"
  ),
  'worker handles SIGINT'
)


check(
  worker.includes(
    'while(!stopping)'
  ) ||
  worker.includes(
    'while (!stopping)'
  ),
  'worker stops polling after shutdown signal'
)


check(
  worker.includes(
    'while(!stopping&&active<concurrency)'
  ) ||
  worker.includes(
    'while (!stopping && active < concurrency)'
  ),
  'worker does not claim new jobs once stopping'
)


const workerCloseRedis =
  worker.lastIndexOf(
    'await closeRedis()'
  )

const workerClosePool =
  worker.lastIndexOf(
    'await closePool()'
  )


check(
  workerCloseRedis >= 0 &&
  workerClosePool > workerCloseRedis,
  'worker closes Redis before PostgreSQL pool'
)


check(
  worker.includes(
    "log.info('worker.stopped'"
  ),
  'worker emits explicit stopped lifecycle event'
)


if(
  failures.length
){
  console.error('')

  console.error(
    `MELEO D10G.6 graceful shutdown self-test: ${failures.length} failure(s)`
  )

  process.exit(1)
}


console.log('')

console.log(
  'MELEO D10G.6 graceful shutdown + request draining self-test: OK'
)