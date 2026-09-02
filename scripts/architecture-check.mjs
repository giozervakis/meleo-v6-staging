import fs from 'node:fs'
const read=f=>fs.readFileSync(f,'utf8')
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)}
const files=['server/relational/app.js','server/relational/repositories.js','server/relational/pool.js']
for(const f of files){const s=read(f);if(s.includes('meleo_docs'))throw new Error(`${f}: legacy meleo_docs reference found`)}
const ddl=read('migrations/001_relational_schema.sql')
for(const table of ['users','professionals','sessions','bookings','booking_messages','reviews','notifications','subscriptions','payments','professional_analytics_daily','rate_limits','geocode_cache'])if(!new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`).test(ddl))throw new Error(`Missing relational table: ${table}`)
const mig2=read('migrations/002_background_jobs_observability.sql')
assert(mig2.includes('background_jobs'),'missing background_jobs migration')
const worker=read('server/worker.js')
const jobRuntime=read('server/services/job-runtime.service.js')
assert(
  worker.includes("import { createJobRuntime } from './services/job-runtime.service.js'") &&
  worker.includes('createJobRuntime({') &&
  worker.includes('jobRuntime.claim()') &&
  jobRuntime.includes('FOR UPDATE SKIP LOCKED'),
  'worker must use canonical SKIP LOCKED job runtime'
)
assert(read('docker-compose.yml').includes('worker:'),'worker service missing')
assert(read('server/routes/system.routes.js').includes('/api/metrics'),'metrics endpoint missing')
assert(read('server/object-storage.js').includes('AWS4-HMAC-SHA256'),'S3 Signature V4 storage client missing')
assert(read('server/relational/app.js').includes('putVerificationObject'),'verification uploads must use object storage abstraction')
assert(read('server/routes/admin-verification.routes.js').includes('/signed'),'temporary signed document access missing')
assert(read('docker-compose.yml').includes('STORAGE_DRIVER: s3'),'production compose must require S3 storage')
assert(!read('docker-compose.yml').includes('meleo-uploads:/app/secure_uploads'),'production must not depend on shared local upload volume')
console.log('MELEO v5.3 architecture check: OK')
