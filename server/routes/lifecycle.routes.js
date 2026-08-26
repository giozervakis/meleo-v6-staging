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
