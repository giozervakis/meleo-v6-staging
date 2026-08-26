import fs from 'node:fs'

const file = 'server/relational/app.js'

let source = fs
  .readFileSync(file, 'utf8')
  .replace(/^\uFEFF/, '')
  .replace(/\r\n/g, '\n')

function fail(message) {
  console.error('[FAIL]', message)
  process.exit(1)
}

function requireOnce(text, label) {
  const first = source.indexOf(text)

  if (first === -1) {
    fail(`Missing anchor: ${label}`)
  }

  const second = source.indexOf(
    text,
    first + text.length
  )

  if (second !== -1) {
    fail(`Anchor is not unique: ${label}`)
  }

  return first
}


// ============================================================
// 1. Lifecycle state BEFORE readiness endpoint
// ============================================================

const readyMarker =
  "app.get('/api/ready'"

const metricsMarker =
  "app.get('/api/metrics'"

const readyStart =
  requireOnce(
    readyMarker,
    '/api/ready'
  )

const metricsStart =
  requireOnce(
    metricsMarker,
    '/api/metrics'
  )

if (metricsStart <= readyStart) {
  fail('/api/metrics must occur after /api/ready')
}

if (!source.includes('let shuttingDown = false')) {
  source =
    source.slice(0, readyStart) +
    `let shuttingDown = false
let shutdownStartedAt = null

` +
    source.slice(readyStart)
}


// ============================================================
// 2. Replace ONLY text between /ready and /metrics
//
// This avoids the dangerous multiline regex used previously.
// ============================================================

const currentReadyStart =
  source.indexOf(readyMarker)

const currentMetricsStart =
  source.indexOf(
    metricsMarker,
    currentReadyStart
  )

if (
  currentReadyStart === -1 ||
  currentMetricsStart === -1
) {
  fail('Could not resolve ready/metrics boundaries')
}

const oldReadyBlock =
  source.slice(
    currentReadyStart,
    currentMetricsStart
  )

if (
  oldReadyBlock.includes(
    "app.get('/api/metrics'"
  )
) {
  fail('Safety invariant violated: metrics found inside ready block')
}

const newReadyBlock =
`app.get('/api/ready',async(_req,res)=>{
  if(shuttingDown){
    return res.status(503).json({
      ok:false,
      service:'MELEO',
      version:APP_VERSION,
      state:'draining',
      shutdownStartedAt
    })
  }

  try{
    await one('SELECT 1 ok')

    let redis=true

    if(config.redis.url){
      try{
        redis=await redisPing()
      }catch{
        redis=false
      }
    }

    const objectStorage=
      await storageReady()

    const checks={
      database:true,
      redis,
      objectStorage,
      payments:
        config.isProd
          ? config.stripeEnabled
          : true,
      mail:
        config.isProd
          ? config.mailEnabled
          : true,
      admin2fa:
        config.isProd
          ? Boolean(config.admin.totpSecret)
          : true
    }

    if(
      (config.redis.required&&!redis) ||
      (config.isProd&&!objectStorage)
    ){
      return res.status(503).json({
        ok:false,
        service:'MELEO',
        version:APP_VERSION,
        state:'degraded',
        checks
      })
    }

    res.json({
      ok:true,
      service:'MELEO',
      version:APP_VERSION,
      instance:
        process.env.INSTANCE_ID||
        process.env.HOSTNAME||
        'local',
      state:'ready',
      checks
    })
  }catch(err){
    log.error(
      'api.readiness.failed',
      {
        message:
          err?.message||
          String(err)
      }
    )

    res.status(503).json({
      ok:false,
      service:'MELEO',
      version:APP_VERSION,
      state:'degraded'
    })
  }
})

`

source =
  source.slice(0, currentReadyStart) +
  newReadyBlock +
  source.slice(currentMetricsStart)


// ============================================================
// 3. Replace shutdown block using deterministic anchors
// ============================================================

const serverMarker =
  'const server=app.listen('

const shutdownTail =
  "process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown)"

const serverStart =
  requireOnce(
    serverMarker,
    'HTTP server startup'
  )

const shutdownEndStart =
  requireOnce(
    shutdownTail,
    'legacy shutdown tail'
  )

const shutdownEnd =
  shutdownEndStart +
  shutdownTail.length

if (shutdownEnd <= serverStart) {
  fail('Invalid server/shutdown boundaries')
}

const lifecycleBlock =
`const server=app.listen(config.port,()=>{
  log.info('api.started',{
    version:APP_VERSION,
    url:\`http://localhost:\${config.port}\`,
    instance:
      process.env.INSTANCE_ID||
      process.env.HOSTNAME||
      'local'
  })

  console.log(
    \`MELEO v\${APP_VERSION} relational API [\${process.env.INSTANCE_ID||process.env.HOSTNAME||'local'}] → http://localhost:\${config.port}\`
  )
})

server.keepAliveTimeout = 65000
server.headersTimeout = 66000

async function shutdown(
  signal='shutdown',
  exitCode=0
){
  if(shuttingDown) return

  shuttingDown=true
  shutdownStartedAt=
    new Date().toISOString()

  log.warn(
    'api.shutdown.started',
    {
      signal,
      shutdownStartedAt
    }
  )

  const forceTimer=setTimeout(
    ()=>{
      log.error(
        'api.shutdown.forced',
        {signal}
      )

      process.exit(1)
    },
    30000
  )

  forceTimer.unref()

  try{
    /*
     * Tell Node to stop accepting new connections.
     *
     * Do NOT await this yet because SSE connections
     * are long-lived and must be closed first.
     */
    const httpClosed=
      new Promise(resolve=>{
        server.close(()=>resolve())
      })

    /*
     * Close SSE clients immediately so server.close()
     * can drain successfully.
     */
    for(
      const clients
      of liveClients.values()
    ){
      for(const client of clients){
        try{
          client.write(
            'event: shutdown\\n' +
            'data: {"reason":"server_restart"}\\n\\n'
          )
        }catch{}

        try{
          client.end()
        }catch{}
      }
    }

    liveClients.clear()

    /*
     * Close idle keep-alive connections where
     * supported by the current Node runtime.
     */
    try{
      server.closeIdleConnections?.()
    }catch{}

    await httpClosed

    try{
      await listener.query(
        'UNLISTEN meleo_live'
      )
    }catch(err){
      log.warn(
        'api.shutdown.unlisten_failed',
        {
          message:
            err?.message||
            String(err)
        }
      )
    }

    try{
      listener.release()
    }catch{}

    await closeRedis()
    await closePool()

    clearTimeout(forceTimer)

    log.info(
      'api.shutdown.completed',
      {signal}
    )

    process.exit(exitCode)
  }catch(err){
    clearTimeout(forceTimer)

    log.error(
      'api.shutdown.failed',
      {
        signal,
        message:
          err?.message||
          String(err),
        stack:err?.stack
      }
    )

    process.exit(1)
  }
}

process.on(
  'SIGTERM',
  ()=>shutdown('SIGTERM',0)
)

process.on(
  'SIGINT',
  ()=>shutdown('SIGINT',0)
)

process.on(
  'uncaughtException',
  err=>{
    log.error(
      'process.uncaught_exception',
      {
        message:
          err?.message||
          String(err),
        stack:err?.stack
      }
    )

    shutdown(
      'uncaughtException',
      1
    ).catch(
      ()=>process.exit(1)
    )
  }
)

process.on(
  'unhandledRejection',
  reason=>{
    const err=
      reason instanceof Error
        ? reason
        : new Error(
            String(reason)
          )

    log.error(
      'process.unhandled_rejection',
      {
        message:err.message,
        stack:err.stack
      }
    )

    shutdown(
      'unhandledRejection',
      1
    ).catch(
      ()=>process.exit(1)
    )
  }
)`

source =
  source.slice(0, serverStart) +
  lifecycleBlock +
  source.slice(shutdownEnd)


// ============================================================
// 4. Structural invariants
// ============================================================

const required = [
  "app.get('/api/health'",
  "app.get('/api/ready'",
  "app.get('/api/metrics'",
  "app.get('/api/plans'",
  "app.get('/api/live'",
  "app.get('/sitemap.xml'",
  'api.shutdown.started',
  'api.shutdown.completed',
  'uncaughtException',
  'unhandledRejection'
]

for (const token of required) {
  if (!source.includes(token)) {
    fail(`Required application feature disappeared: ${token}`)
  }
}

if (
  source.indexOf("app.get('/api/ready'") >
  source.indexOf("app.get('/api/metrics'")
) {
  fail('Route ordering invariant failed')
}


// ============================================================
// 5. Clean text
// ============================================================

source = source
  .split('\n')
  .map(
    line=>
      line.replace(
        /[ \t]+$/,
        ''
      )
  )
  .join('\n')
  .replace(/\n*$/, '') + '\n'

fs.writeFileSync(
  file,
  source,
  'utf8'
)

console.log('[PASS] readiness draining installed')
console.log('[PASS] metrics route preserved')
console.log('[PASS] graceful HTTP draining installed')
console.log('[PASS] SSE closes before HTTP drain wait')
console.log('[PASS] Redis/Postgres shutdown installed')
console.log('[PASS] fatal process handlers installed')
console.log('[PASS] structural invariants verified')
