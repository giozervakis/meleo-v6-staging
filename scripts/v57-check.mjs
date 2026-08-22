import fs from 'node:fs'
const must=['scripts/release-preflight.mjs','scripts/tls-readiness.mjs','scripts/stripe-readiness.mjs','scripts/backup-db.mjs','scripts/restore-drill.mjs','scripts/release-go-no-go.mjs','PRODUCTION_RELEASE_CANDIDATE_v5.7.md','V5.7_RELEASE_NOTES.md']
const missing=must.filter(x=>!fs.existsSync(x)); if(missing.length){console.error('Missing:',missing);process.exit(1)}
const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); if(pkg.version!=='5.7.0') {console.error('package version is not 5.7.0');process.exit(1)}
console.log('MELEO v5.7 release-candidate architecture check: OK')
