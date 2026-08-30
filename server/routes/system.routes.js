/**
 * MELEO v6.3.0
 *
 * Public/system HTTP routes.
 *
 * Deliberately dependency-injected:
 * this module must not become a second application monolith.
 *
 * Route ownership:
 *
 * - /api/config   -> system.routes.js
 * - /api/health   -> system.routes.js
 * - /api/metrics  -> system.routes.js
 * - /api/plans    -> system.routes.js
 * - /api/ready    -> lifecycle.routes.js
 * - /api/live     -> relational/app.js
 *
 * Readiness is isolated in lifecycle.routes.js because it depends
 * on graceful-shutdown state.
 *
 * Realtime SSE remains in relational/app.js because the application
 * lifecycle owns the PostgreSQL LISTEN/UNLISTEN connection and the
 * active SSE client registry.
 */
export function registerSystemRoutes(
  app,
  {
    config,
    googleOAuthEnabled,
    APP_VERSION,
    PLANS,
    one,
    getPool,
    queueStats,
    metricsText
  }
) {
  if (!app) {
    throw new Error(
      'registerSystemRoutes requires an Express app'
    )
  }

  const required = {
    config,
    googleOAuthEnabled,
    APP_VERSION,
    PLANS,
    one,
    getPool,
    queueStats,
    metricsText
  }

  for (
    const [
      name,
      value
    ] of Object.entries(required)
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      throw new Error(
        `registerSystemRoutes missing dependency: ${name}`
      )
    }
  }


  // ------------------------------------------------------------
  // Public client configuration
  // ------------------------------------------------------------

  app.get(
    '/api/config',
    (_req, res) =>
      res.json({
        env:
          config.env,

        demoAuth:
          config.demoAuth,

        googleOAuthEnabled:
          Boolean(googleOAuthEnabled),

        demoCheckout:
          config.demoCheckout,

        paymentsEnabled:
          config.stripeEnabled,

        mailEnabled:
          config.mailEnabled,

        portalEnabled:
          config.stripeEnabled &&
          config.stripe.portalEnabled,

        plans:
          Object.values(
            PLANS
          ),

        termsVersion:
          config.legal.termsVersion,

        emergencyNumber:
          config.emergencyNumber,

        legal:{
          company:
            config.legal.company,

          vatNumber:
            config.legal.vatNumber,

          address:
            config.legal.address,

          supportEmail:
            config.mail.supportEmail,

          dpoEmail:
            config.legal.dpoEmail
        }
      })
  )


  // ------------------------------------------------------------
  // Liveness / basic service health
  // ------------------------------------------------------------

  app.get(
    '/api/health',
    async (
      _req,
      res
    ) => {
      const counts =
        await one(
          `
          SELECT
            (SELECT count(*) FROM users)::int users,
            (SELECT count(*) FROM professionals)::int professionals
          `
        )

      res.json({
        ok:true,

        service:
          'MELEO API',

        version:
          APP_VERSION,

        instance:
          process.env.INSTANCE_ID ||
          process.env.HOSTNAME ||
          'local',

        env:
          config.env,

        storage:{
          database:
            'postgres-relational',

          documents:
            config.storage.driver,

          multiInstanceSafe:
            config.storage.driver ===
            's3',

          redis:
            Boolean(
              config.redis.url
            )
        },

        ...counts
      })
    }
  )


  // ------------------------------------------------------------
  // Prometheus metrics
  // ------------------------------------------------------------

  app.get(
    '/api/metrics',
    async (
      req,
      res
    ) => {
      if (
        config.isHosted
      ) {
        const supplied =
          String(
            req.headers.authorization ||
            ''
          )
            .replace(
              /^Bearer\s+/i,
              ''
            )

        if (
          !config.observability.metricsToken ||
          supplied !==
            config.observability.metricsToken
        ) {
          return res
            .status(404)
            .end()
        }
      }


      const q =
        await queueStats()

      const pool =
        getPool()


      res
        .type(
          'text/plain; version=0.0.4'
        )
        .send(
          metricsText({
            background_jobs_pending:
              q.pending,

            background_jobs_processing:
              q.processing,

            background_jobs_failed:
              q.failed,

            postgres_pool_total:
              pool.totalCount,

            postgres_pool_idle:
              pool.idleCount,

            postgres_pool_waiting:
              pool.waitingCount
          })
        )
    }
  )


  // ------------------------------------------------------------
  // Commercial plans
  // ------------------------------------------------------------

  app.get(
    '/api/plans',
    (
      _req,
      res
    ) =>
      res.json(
        Object.values(
          PLANS
        )
      )
  )
}
