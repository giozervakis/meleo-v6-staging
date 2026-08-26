import fs from 'node:fs'

const file =
  'server/relational/app.js'

let source =
  fs
    .readFileSync(
      file,
      'utf8'
    )
    .replace(
      /^\uFEFF/,
      ''
    )
    .replace(
      /\r\n/g,
      '\n'
    )


function fail(message) {
  console.error(
    '[FAIL]',
    message
  )

  process.exit(1)
}


function exactlyOnce(
  text,
  needle,
  label
) {
  let count = 0
  let position = 0

  while (
    (
      position =
        text.indexOf(
          needle,
          position
        )
    ) !== -1
  ) {
    count++
    position +=
      needle.length
  }

  if (
    count !== 1
  ) {
    fail(
      `${label}: expected exactly once, found ${count}`
    )
  }
}


// ------------------------------------------------------------
// Module import
// ------------------------------------------------------------

const routeImport =
  "import { registerSystemRoutes } from '../routes/system.routes.js'"

if (
  !source.includes(
    routeImport
  )
) {
  const versionImport =
    "import { APP_VERSION, RELEASE_CHANNEL } from '../version.js'"

  exactlyOnce(
    source,
    versionImport,
    'version import'
  )

  source =
    source.replace(
      versionImport,
      `${versionImport}\n${routeImport}`
    )
}


// ------------------------------------------------------------
// Exact legacy route definitions.
//
// These are intentionally exact strings from the current
// v6.2.1 production relational app so accidental source drift
// makes this migration FAIL rather than guessing.
// ------------------------------------------------------------

const configRoute =
  "app.get('/api/config',(_req,res)=>res.json({env:config.env,demoAuth:config.demoAuth,demoCheckout:config.demoCheckout,paymentsEnabled:config.stripeEnabled,mailEnabled:config.mailEnabled,portalEnabled:config.stripeEnabled&&config.stripe.portalEnabled,plans:Object.values(PLANS),termsVersion:config.legal.termsVersion,emergencyNumber:config.emergencyNumber,legal:{company:config.legal.company,vatNumber:config.legal.vatNumber,address:config.legal.address,supportEmail:config.mail.supportEmail,dpoEmail:config.legal.dpoEmail}}))"

const healthRoute =
  "app.get('/api/health',async(_req,res)=>{const counts=await one(`SELECT (SELECT count(*) FROM users)::int users,(SELECT count(*) FROM professionals)::int professionals`);res.json({ok:true,service:'MELEO API',version:APP_VERSION,instance:process.env.INSTANCE_ID||process.env.HOSTNAME||'local',env:config.env,storage:{database:'postgres-relational',documents:config.storage.driver,multiInstanceSafe:config.storage.driver==='s3',redis:Boolean(config.redis.url)},...counts})})"

const metricsRoute =
  "app.get('/api/metrics',async(req,res)=>{if(config.isHosted){const supplied=String(req.headers.authorization||'').replace(/^Bearer\\s+/i,'');if(!config.observability.metricsToken||supplied!==config.observability.metricsToken)return res.status(404).end()}const q=await queueStats();const pool=getPool();res.type('text/plain; version=0.0.4').send(metricsText({background_jobs_pending:q.pending,background_jobs_processing:q.processing,background_jobs_failed:q.failed,postgres_pool_total:pool.totalCount,postgres_pool_idle:pool.idleCount,postgres_pool_waiting:pool.waitingCount}))})"

const plansRoute =
  "app.get('/api/plans',(_req,res)=>res.json(Object.values(PLANS)))"


const alreadyRegistered =
  source.includes(
    'registerSystemRoutes('
  )


if (
  !alreadyRegistered
) {
  exactlyOnce(
    source,
    configRoute,
    '/api/config'
  )

  exactlyOnce(
    source,
    healthRoute,
    '/api/health'
  )

  exactlyOnce(
    source,
    metricsRoute,
    '/api/metrics'
  )

  exactlyOnce(
    source,
    plansRoute,
    '/api/plans'
  )


  // Preserve the shutdown state directly after system registration.
  const replacement =
`registerSystemRoutes(
  app,
  {
    config,
    APP_VERSION,
    PLANS,
    one,
    getPool,
    queueStats,
    metricsText
  }
)`

  source =
    source.replace(
      `${configRoute}\n${healthRoute}`,
      replacement
    )

  source =
    source.replace(
      `${metricsRoute}\n${plansRoute}`,
      ''
    )
}


// ------------------------------------------------------------
// Safety: old definitions must be gone.
// ------------------------------------------------------------

for (
  const [
    label,
    oldRoute
  ] of [
    [
      '/api/config',
      configRoute
    ],
    [
      '/api/health',
      healthRoute
    ],
    [
      '/api/metrics',
      metricsRoute
    ],
    [
      '/api/plans',
      plansRoute
    ]
  ]
) {
  if (
    source.includes(
      oldRoute
    )
  ) {
    fail(
      `${label} legacy route still remains`
    )
  }
}


// ------------------------------------------------------------
// Safety: lifecycle routes MUST remain untouched.
// ------------------------------------------------------------

if (
  !source.includes(
    "app.get('/api/ready'"
  )
) {
  fail(
    '/api/ready was unexpectedly removed'
  )
}

if (
  !source.includes(
    "app.get('/api/live'"
  )
) {
  fail(
    '/api/live was unexpectedly removed'
  )
}

if (
  !source.includes(
    'LISTEN meleo_live'
  )
) {
  fail(
    'SSE LISTEN lifecycle was unexpectedly modified'
  )
}

if (
  !source.includes(
    'UNLISTEN meleo_live'
  )
) {
  fail(
    'SSE UNLISTEN lifecycle was unexpectedly modified'
  )
}


// ------------------------------------------------------------
// UTF-8 safety.
//
// Known valid Greek strings must still survive the patch.
// ------------------------------------------------------------

for (
  const sample of [
    'Συμπλήρωσε',
    'Επαγγελματίας',
    'Λάθος email ή κωδικός.'
  ]
) {
  if (
    !source.includes(
      sample
    )
  ) {
    fail(
      `UTF-8 sentinel disappeared: ${sample}`
    )
  }
}


source =
  source
    .split('\n')
    .map(
      line =>
        line.replace(
          /[ \t]+$/,
          ''
        )
    )
    .join('\n')
    .replace(
      /\n*$/,
      '\n'
    )


fs.writeFileSync(
  file,
  source,
  'utf8'
)


console.log(
  '[PASS] registerSystemRoutes imported'
)

console.log(
  '[PASS] /api/config extracted'
)

console.log(
  '[PASS] /api/health extracted'
)

console.log(
  '[PASS] /api/metrics extracted'
)

console.log(
  '[PASS] /api/plans extracted'
)

console.log(
  '[PASS] /api/ready lifecycle preserved'
)

console.log(
  '[PASS] /api/live lifecycle preserved'
)

console.log(
  '[PASS] UTF-8 sentinels preserved'
)
