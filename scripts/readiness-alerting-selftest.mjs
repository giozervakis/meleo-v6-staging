import fs from 'node:fs'
const read=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error(`RC3-C5 readiness/alerting self-test: FAIL - ${m}`);process.exit(1)}

const lifecycle=read('server/routes/lifecycle.routes.js')
const operational=read('server/operational-metrics.js')
const system=read('server/routes/system.routes.js')
const app=read('server/relational/app.js')
const render=read('render.yaml')
const pkg=JSON.parse(read('package.json'))

for(const marker of [
  "app.get('/api/liveness'",
  "app.get('/api/ready'",
  "state:'live'",
  "state:'degraded'",
  "state:'draining'",
  "criticalFailures",
  "operational.worker_up===1",
  "operational.postgres_operational_up===1"
]) if(!lifecycle.includes(marker)) fail(`lifecycle missing ${marker}`)

const hasReadyState =
  /state\s*:\s*(?:'ready'|degraded\s*\?\s*'degraded'\s*:\s*'ready')/s
    .test(lifecycle)

if(!hasReadyState)
  fail('lifecycle missing ready state contract')

for(const marker of [
  'alert_database_down',
  'alert_redis_down',
  'alert_worker_down',
  'alert_queue_failed',
  'alert_queue_backlog',
  'alert_stripe_reconcile_failed',
  'alert_stripe_reconcile_stale',
  'alert_active_total'
]) if(!operational.includes(marker)) fail(`alert metric missing ${marker}`)

if(!system.includes('evaluateOperationalAlerts')) fail('alert evaluator not exposed')
if(!system.includes('...alerts')) fail('alert metrics not merged')
if(!app.includes('collectOperationalMetrics')) fail('collector not wired to lifecycle')
if(!render.includes('healthCheckPath: /api/ready')) fail('Render health path not readiness')
if(pkg.scripts?.['readiness-alerting-check']!=='node scripts/readiness-alerting-selftest.mjs')
  fail('package script missing')
if(!pkg.scripts?.['ci:gate']?.includes('readiness-alerting-check'))
  fail('CI gate missing')

console.log('RC3-C5 readiness/alerting self-test: PASS')
