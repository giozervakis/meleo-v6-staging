/*
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
    collectOperationalMetrics,
    APP_VERSION,
    log,
    getShuttingDown,
    getShutdownStartedAt
  } = deps

  app.get('/api/liveness',(_req,res)=>{
    res.json({
      ok:true,
      service:'MELEO',
      version:APP_VERSION,
      state:'live',
      instance:
        process.env.INSTANCE_ID||
        process.env.HOSTNAME||
        'local'
    })
  })

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
      const operational =
        await collectOperationalMetrics()

      const objectStorage =
        await storageReady()

      const workerRequired =
        config.isHosted &&
        Boolean(config.redis.url)

      const checks={
        database:
          operational.postgres_operational_up===1,

        redis:
          !config.redis.url ||
          operational.redis_up===1,

        worker:
          !workerRequired ||
          operational.worker_up===1,

        objectStorage,

        payments:
          !config.isProd ||
          config.stripeEnabled,

        mail:
          !config.isProd ||
          config.mailEnabled,

        admin2fa:
          !config.isProd ||
          Boolean(config.admin.totpSecret)
      }

      const criticalFailures=[]

      if(!checks.database)
        criticalFailures.push('database')

      if(config.redis.required&&!checks.redis)
        criticalFailures.push('redis')

      if(workerRequired&&!checks.worker)
        criticalFailures.push('worker')

      if(config.isProd&&!checks.objectStorage)
        criticalFailures.push('objectStorage')

      if(config.isProd&&!checks.payments)
        criticalFailures.push('payments')

      if(config.isProd&&!checks.mail)
        criticalFailures.push('mail')

      if(config.isProd&&!checks.admin2fa)
        criticalFailures.push('admin2fa')

      if(criticalFailures.length){
        return res.status(503).json({
          ok:false,
          service:'MELEO',
          version:APP_VERSION,
          state:'degraded',
          checks,
          criticalFailures
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
        checks,
        criticalFailures:[]
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
        state:'degraded',
        criticalFailures:['readiness_probe']
      })
    }
  })
}
