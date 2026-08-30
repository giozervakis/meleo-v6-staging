import fs from 'node:fs'
const read=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error(`RC3-C4 operational metrics self-test: FAIL - ${m}`);process.exit(1)}

const op=read('server/operational-metrics.js')
const worker=read('server/worker.js')
const system=read('server/routes/system.routes.js')
const app=read('server/relational/app.js')
const pkg=JSON.parse(read('package.json'))

for(const marker of [
  'postgres_operational_up','postgres_operational_query_ms',
  'redis_configured','redis_up','redis_ping_ms',
  'worker_up','worker_heartbeat_age_seconds','worker_active_jobs',
  'worker_concurrency','worker_oldest_pending_seconds',
  'stripe_configured','stripe_subscriptions_active',
  'stripe_subscriptions_past_due','stripe_reconcile_pending',
  'stripe_reconcile_processing','stripe_reconcile_failed',
  'stripe_reconcile_last_success_age_seconds'
]) if(!op.includes(marker)) fail(`missing ${marker}`)

if(!worker.includes("meleo:observability:worker:heartbeat")) fail('worker heartbeat key missing')
if(!worker.includes('redisSetJson(')) fail('worker heartbeat publish missing')
if(!system.includes('collectOperationalMetrics')) fail('system collector missing')
if(!system.includes('...operational')) fail('metrics merge missing')
if(!app.includes("from '../operational-metrics.js'")) fail('app wiring missing')
if(pkg.scripts?.['operational-metrics-check']!=='node scripts/operational-metrics-selftest.mjs') fail('package script missing')
if(!pkg.scripts?.['ci:gate']?.includes('operational-metrics-check')) fail('ci gate missing')

console.log('RC3-C4 operational metrics self-test: PASS')
