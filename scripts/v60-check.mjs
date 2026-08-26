import fs from 'node:fs'
const must=['server/version.js','scripts/release-manifest.mjs','scripts/launch-guard.mjs','LAUNCH_RUNBOOK_v6.0.md','V6_RELEASE_NOTES.md']
for(const f of must) if(!fs.existsSync(f)){console.error('missing',f);process.exit(1)}
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
if(pkg.version!=='6.2.0') throw new Error('package version is not 6.2.0')
const ver=fs.readFileSync('server/version.js','utf8')
if(!ver.includes("APP_VERSION = '6.2.0'")) throw new Error('server version mismatch')
const app=fs.readFileSync('server/relational/app.js','utf8')
if(/version:'5\.[0-9]+\.0'/.test(app)) throw new Error('stale hard-coded API version found')
const compose=fs.readFileSync('docker-compose.yml','utf8')
if(!compose.includes('meleo:v60:')) throw new Error('Redis prefix is not v60')
console.log('MELEO v6.0 production launch architecture check: OK')
