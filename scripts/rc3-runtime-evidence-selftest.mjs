import fs from 'node:fs'
import assert from 'node:assert/strict'
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const src=fs.readFileSync('scripts/rc3-runtime-evidence.mjs','utf8')
assert.equal(pkg.scripts['runtime-evidence'],'node scripts/rc3-runtime-evidence.mjs')
assert.equal(pkg.scripts['runtime-evidence-check'],'node scripts/rc3-runtime-evidence-selftest.mjs')
assert.ok(pkg.scripts['ci:gate'].includes('npm run runtime-evidence-check'))
for(const token of ['NODE_ENV=staging','DATABASE_URL','MELEO_STAGING_URL','booking-concurrency-test.mjs','migration-runner-selftest.mjs','gdpr-account-selftest.mjs','authorization-stripe-selftest.mjs','database-tls-selftest.mjs','health-c8','PARTIAL_PASS_AWAITING_CREDENTIALED_RUNTIME','notYetFreshLiveCoverage','not a production capacity benchmark']) assert.ok(src.includes(token),`missing ${token}`)
assert.ok(!src.includes('MELEO_ALLOW_PRODUCTION_CONCURRENCY_TEST=1'))
console.log('MELEO RC3-B1 runtime evidence harness self-test: OK')