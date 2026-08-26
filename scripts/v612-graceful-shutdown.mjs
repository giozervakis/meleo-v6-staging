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


// ============================================================
// 1. Add process lifecycle state
// ============================================================

const listenerAnchor =
`const liveClients=new Map();const listener=await getPool().connect();await listener.query('LISTEN meleo_live');`

const listenerReplacement =
`const liveClients=new Map()

let shuttingDown = false
let shutdownStartedAt = null

const listener=await getPool().connect()
await listener.query('LISTEN meleo_live');`

if (!source.includes('let shuttingDown = false')) {
  if (!source.includes(listenerAnchor)) {
    fail('Could not locate live listener anchor')
  }

  source = source.replace(
    listenerAnchor,
    listenerReplacement
  )
}


// ============================================================
// 2. Upgrade readiness endpoint
// ============================================================

const readyRegex =
/app\.get\('\/api\/ready',[\s\S]*?\n\}\)\n/

const match = source.match(readyRegex)

if (!match) {
  fail('Could not locate /api/ready endpoint')
}

if (!match[0].includes('shuttingDown')) {
  const oldReady = match[0]

  const newReady =
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
    const db=await one('SELECT 1 AS ok')
    const redisOk=
      config.redis.required
        ? await redisPing()
        : true

    const checks={
      database:Boolean(db?.ok),
      redis:Boolean(redisOk)
    }

    const ok=
      Object.values(checks)
        .every(Boolean)

    res.status(ok?200:503).json({
      ok,
      service:'MELEO',
      version:APP_VERSION,
      state:ok?'ready':'degraded',
      checks
    })
  }catch(err){
    log.error('api.readiness.failed',{
      message:err?.message||String(err)
    })

    res.status(503).json({
      ok:false,
      service:'MELEO',
      version:APP_VERSION,
      state:'degraded'
    })
  }
})
`

  source = source.replace(
    oldReady,
    newReady
  )
}


// ============================================================
// 3. Replace shutdown implementation
// ============================================================

const oldShutdown =
`const server=app.listen(config.port,()=>{log.info('api.started',{version:APP_VERSION,url:\`http://localhost:\${config.port}\`,instance:process.env.INSTANCE_ID||process.env.HOSTNAME||'local'});console.log(\`MELEO v\${APP_VERSION} relational API [\${process.env.INSTANCE_ID||process.env.HOSTNAME||'local'}] → http://localhost:\${config.port}\`)})
async function shutdown(){server.close();try{await listener.query('UNLISTEN meleo_live');listener.release()}catch{}await closeRedis();await closePool();process.exit(0)}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown)`

const newShutdown =
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

async function shutdown(signal='shutdown',exitCode=0){
  if(shuttingDown) return

  shuttingDown = true
  shutdownStartedAt = new Date().toISOString()

  log.warn('api.shutdown.started',{
    signal,
    shutdownStartedAt
  })

  const forceTimer=setTimeout(()=>{
    log.error('api.shutdown.forced',{
      signal
    })

    process.exit(1)
  },30000)

  forceTimer.unref()

  try{
    // Stop accepting new HTTP connections.
    await new Promise(resolve=>{
      server.close(()=>resolve())
    })

    // Close active SSE streams so deploys do not wait indefinitely.
    for(const clients of liveClients.values()){
      for(const client of clients){
        try{
          client.write(
            'event: shutdown\\ndata: {"reason":"server_restart"}\\n\\n'
          )
        }catch{}

        try{
          client.end()
        }catch{}
      }
    }

    liveClients.clear()

    try{
      await listener.query(
        'UNLISTEN meleo_live'
      )
    }catch(err){
      log.warn('api.shutdown.unlisten_failed',{
        message:err?.message||String(err)
      })
    }

    try{
      listener.release()
    }catch{}

    await closeRedis()
    await closePool()

    clearTimeout(forceTimer)

    log.info('api.shutdown.completed',{
      signal
    })

    process.exit(exitCode)
  }catch(err){
    clearTimeout(forceTimer)

    log.error('api.shutdown.failed',{
      signal,
      message:err?.message||String(err),
      stack:err?.stack
    })

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
    log.error('process.uncaught_exception',{
      message:err?.message||String(err),
      stack:err?.stack
    })

    shutdown(
      'uncaughtException',
      1
    ).catch(()=>process.exit(1))
  }
)

process.on(
  'unhandledRejection',
  reason=>{
    const err=
      reason instanceof Error
        ? reason
        : new Error(String(reason))

    log.error('process.unhandled_rejection',{
      message:err.message,
      stack:err.stack
    })

    shutdown(
      'unhandledRejection',
      1
    ).catch(()=>process.exit(1))
  }
)`

if (!source.includes('api.shutdown.started')) {
  if (!source.includes(oldShutdown)) {
    fail('Could not locate current shutdown block')
  }

  source = source.replace(
    oldShutdown,
    newShutdown
  )
}


// ============================================================
// 4. No trailing whitespace / single EOF newline
// ============================================================

source = source
  .split('\n')
  .map(line=>line.replace(/[ \t]+$/,''))
  .join('\n')
  .replace(/\n+$/,'\n')

fs.writeFileSync(
  file,
  source,
  'utf8'
)

console.log('[PASS] Graceful shutdown implemented')
console.log('[PASS] Readiness draining implemented')
console.log('[PASS] SSE shutdown implemented')
console.log('[PASS] SIGTERM/SIGINT handling implemented')
console.log('[PASS] uncaughtException protection implemented')
console.log('[PASS] unhandledRejection protection implemented')
