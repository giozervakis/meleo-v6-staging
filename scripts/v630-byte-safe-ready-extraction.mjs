import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const appFile =
  'server/relational/app.js'

const lifecycleFile =
  'server/routes/lifecycle.routes.js'

let source =
  fs.readFileSync(
    appFile,
    'utf8'
  )
    .replace(/^\uFEFF/,'')
    .replace(/\r\n/g,'\n')


const startMarker =
  "app.get('/api/ready',async(_req,res)=>{"

const nextMarker =
  "app.post('/api/auth/register'"


const start =
  source.indexOf(
    startMarker
  )

if (start === -1) {
  throw new Error(
    '/api/ready start marker not found'
  )
}


const next =
  source.indexOf(
    nextMarker,
    start
  )

if (
  next === -1 ||
  next <= start
) {
  throw new Error(
    'Invalid /api/ready boundary'
  )
}


const ready =
  source.slice(
    start,
    next
  )


const required = [
  "await one('SELECT 1 ok')",
  'redisPing()',
  'storageReady()',
  'APP_VERSION',
  "state:'draining'",
  "state:'degraded'",
  "state:'ready'"
]

for (const token of required) {
  if (!ready.includes(token)) {
    throw new Error(
      `Readiness source missing ${token}`
    )
  }
}


const before =
  source.slice(
    0,
    start
  )

const after =
  source.slice(
    next
  )


const lifecycle =
`/*
 * MELEO v6.3.0
 * Readiness lifecycle route.
 *
 * Realtime SSE and PostgreSQL LISTEN/NOTIFY lifecycle
 * intentionally remain in relational/app.js.
 */

export function registerLifecycleRoutes(
  app,
  deps
) {
  const {
    config,
    one,
    redisPing,
    storageReady,
    APP_VERSION,
    log,
    getShuttingDown,
    getShutdownStartedAt
  } = deps

  app.get('/api/ready',async(_req,res)=>{
    const shuttingDown =
      getShuttingDown()

    const shutdownStartedAt =
      getShutdownStartedAt()

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
}
`


fs.mkdirSync(
  path.dirname(
    lifecycleFile
  ),
  {
    recursive:true
  }
)

fs.writeFileSync(
  lifecycleFile,
  lifecycle,
  'utf8'
)


const registration =
`registerLifecycleRoutes(
  app,
  {
    config,
    one,
    redisPing,
    storageReady,
    APP_VERSION,
    log,
    getShuttingDown:()=>shuttingDown,
    getShutdownStartedAt:()=>shutdownStartedAt
  }
)

`


let updated =
  before +
  registration +
  after


const systemImport =
  "import { registerSystemRoutes } from '../routes/system.routes.js'"

const lifecycleImport =
  "import { registerLifecycleRoutes } from '../routes/lifecycle.routes.js'"


if (
  !updated.includes(
    systemImport
  )
) {
  throw new Error(
    'system routes import missing'
  )
}


if (
  !updated.includes(
    lifecycleImport
  )
) {
  updated =
    updated.replace(
      systemImport,
      systemImport +
      '\n' +
      lifecycleImport
    )
}


// ------------------------------------------------------------
// Strong safety checks
// ------------------------------------------------------------

if (
  updated.includes(
    "app.get('/api/ready'"
  )
) {
  throw new Error(
    '/api/ready still exists in app.js'
  )
}

if (
  !updated.includes(
    'registerLifecycleRoutes('
  )
) {
  throw new Error(
    'lifecycle registration missing'
  )
}

for (
  const token of [
    "app.post('/api/auth/register'",
    "app.get('/api/live'",
    'LISTEN meleo_live',
    'UNLISTEN meleo_live',
    'metricsText'
  ]
) {
  if (
    !updated.includes(token)
  ) {
    throw new Error(
      `Protected token disappeared: ${token}`
    )
  }
}


fs.writeFileSync(
  appFile,
  updated.replace(/\n*$/,'\n'),
  'utf8'
)


console.log(
  '[PASS] /api/ready extracted'
)

console.log(
  '[PASS] app.js written through Node UTF-8 I/O'
)

console.log(
  '[PASS] lifecycle module written'
)
