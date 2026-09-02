import {
  registerLifecycleRoutes
} from '../server/routes/lifecycle.routes.js'


const failures = []


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


function makeResponse(){

  return {
    statusCode:200,
    body:null,

    status(code){
      this.statusCode=code
      return this
    },

    json(body){
      this.body=body
      return this
    }
  }
}


function buildRoute({
  isHosted=false,
  isProd=true,
  redisUrl='redis://test',
  redisRequired=true,
  postgresUp=true,
  redisUp=true,
  workerUp=true,
  storageUp=true,
  stripeEnabled=true,
  mailEnabled=true,
  adminTotpSecret='test-secret',
  shuttingDown=false
}={}){

  const routes =
    new Map()


  const app = {
    get(path,handler){
      routes.set(
        path,
        handler
      )
    }
  }


  registerLifecycleRoutes(
    app,
    {
      config:{
        isHosted,
        isProd,

        redis:{
          url:redisUrl,
          required:redisRequired
        },

        stripeEnabled,
        mailEnabled,

        admin:{
          totpSecret:
            adminTotpSecret
        }
      },

      one:
        async()=>({
          ok:true
        }),

      redisPing:
        async()=>redisUp,

      storageReady:
        async()=>storageUp,

      collectOperationalMetrics:
        async()=>({
          postgres_operational_up:
            postgresUp ? 1 : 0,

          redis_up:
            redisUp ? 1 : 0,

          worker_up:
            workerUp ? 1 : 0
        }),

      APP_VERSION:
        'd10g-test',

      log:{
        error(){}
      },

      getShuttingDown:
        ()=>shuttingDown,

      getShutdownStartedAt:
        ()=>null
    }
  )


  const handler =
    routes.get(
      '/api/ready'
    )


  if(
    typeof handler !==
      'function'
  ){
    throw new Error(
      'Readiness handler not registered'
    )
  }


  return handler
}


async function probe(options){

  const handler =
    buildRoute(options)

  const response =
    makeResponse()

  await handler(
    {},
    response
  )

  return response
}


// ------------------------------------------------------------
// Healthy
// ------------------------------------------------------------

{
  const response =
    await probe({
      isHosted:true
    })

  check(
    response.statusCode === 200,
    'healthy readiness returns HTTP 200'
  )

  check(
    response.body?.state ===
      'ready',
    'healthy readiness reports ready state'
  )

  check(
    Array.isArray(
      response.body?.criticalFailures
    ) &&
    response.body
      .criticalFailures
      .length === 0,
    'healthy readiness has no critical failures'
  )

  check(
    Array.isArray(
      response.body?.degradedCapabilities
    ) &&
    response.body
      .degradedCapabilities
      .length === 0,
    'healthy readiness has no degraded capabilities'
  )
}


// ------------------------------------------------------------
// PostgreSQL is critical
// ------------------------------------------------------------

{
  const response =
    await probe({
      postgresUp:false
    })

  check(
    response.statusCode === 503,
    'PostgreSQL failure returns HTTP 503'
  )

  check(
    response.body
      ?.criticalFailures
      ?.includes(
        'database'
      ),
    'PostgreSQL failure is classified critical'
  )
}


// ------------------------------------------------------------
// Required Redis is critical
// ------------------------------------------------------------

{
  const response =
    await probe({
      redisRequired:true,
      redisUp:false
    })

  check(
    response.statusCode === 503,
    'required Redis failure returns HTTP 503'
  )

  check(
    response.body
      ?.criticalFailures
      ?.includes(
        'redis'
      ),
    'required Redis failure is classified critical'
  )
}


// ------------------------------------------------------------
// Optional Redis is degraded only
// ------------------------------------------------------------

{
  const response =
    await probe({
      redisRequired:false,
      redisUp:false
    })

  check(
    response.statusCode === 200,
    'optional Redis failure preserves HTTP 200'
  )

  check(
    response.body?.state ===
      'degraded',
    'optional Redis failure reports degraded state'
  )

  check(
    response.body
      ?.degradedCapabilities
      ?.includes(
        'redis'
      ),
    'optional Redis is reported as degraded capability'
  )
}


// ------------------------------------------------------------
// Object storage is degraded only
// ------------------------------------------------------------

{
  const response =
    await probe({
      storageUp:false
    })

  check(
    response.statusCode === 200,
    'object storage failure preserves HTTP 200'
  )

  check(
    response.body
      ?.degradedCapabilities
      ?.includes(
        'objectStorage'
      ),
    'object storage is reported as degraded capability'
  )
}


// ------------------------------------------------------------
// Stripe/payments are degraded only
// ------------------------------------------------------------

{
  const response =
    await probe({
      stripeEnabled:false
    })

  check(
    response.statusCode === 200,
    'Stripe capability failure preserves HTTP 200'
  )

  check(
    response.body
      ?.degradedCapabilities
      ?.includes(
        'payments'
      ),
    'Stripe capability is reported degraded'
  )
}


// ------------------------------------------------------------
// Mail is degraded only
// ------------------------------------------------------------

{
  const response =
    await probe({
      mailEnabled:false
    })

  check(
    response.statusCode === 200,
    'mail capability failure preserves HTTP 200'
  )

  check(
    response.body
      ?.degradedCapabilities
      ?.includes(
        'mail'
      ),
    'mail capability is reported degraded'
  )
}


// ------------------------------------------------------------
// Worker required in hosted Redis deployment
// ------------------------------------------------------------

{
  const response =
    await probe({
      isHosted:true,
      workerUp:false
    })

  check(
    response.statusCode === 503,
    'required worker failure returns HTTP 503'
  )

  check(
    response.body
      ?.criticalFailures
      ?.includes(
        'worker'
      ),
    'required worker failure is classified critical'
  )
}


// ------------------------------------------------------------
// Production admin 2FA remains critical configuration
// ------------------------------------------------------------

{
  const response =
    await probe({
      adminTotpSecret:''
    })

  check(
    response.statusCode === 503,
    'missing production admin 2FA returns HTTP 503'
  )

  check(
    response.body
      ?.criticalFailures
      ?.includes(
        'admin2fa'
      ),
    'admin 2FA remains critical production prerequisite'
  )
}


// ------------------------------------------------------------
// Shutdown/draining remains unready
// ------------------------------------------------------------

{
  const response =
    await probe({
      shuttingDown:true
    })

  check(
    response.statusCode === 503,
    'draining process returns HTTP 503'
  )

  check(
    response.body?.state ===
      'draining',
    'draining lifecycle state preserved'
  )
}


if(
  failures.length
){
  console.error('')

  console.error(
    `MELEO D10G.1 readiness criticality self-test: ${failures.length} failure(s)`
  )

  process.exit(1)
}


console.log('')

console.log(
  'MELEO D10G.1 readiness criticality self-test: OK'
)