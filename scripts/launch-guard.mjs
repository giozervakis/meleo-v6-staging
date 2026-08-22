import fs from 'node:fs'
import crypto from 'node:crypto'

if(process.loadEnvFile && fs.existsSync('.env')) process.loadEnvFile('.env')
const fail=[]
const warn=[]
const maxAgeH=Number(process.env.RELEASE_EVIDENCE_MAX_AGE_HOURS||72)
if(process.env.NODE_ENV!=='production') fail.push('NODE_ENV must be production')
if(process.env.LAUNCH_APPROVED!=='YES') fail.push('LAUNCH_APPROVED must be YES after human go-live approval')
if(process.env.RELEASE_TAG!=='v6.0.0') fail.push('RELEASE_TAG must be v6.0.0')
let go
try{go=JSON.parse(fs.readFileSync('reports/release-go-no-go.json','utf8'))}catch{fail.push('reports/release-go-no-go.json is missing')}
if(go){
  if(go.decision!=='GO') fail.push('v5.7 release evidence decision is not GO')
  const t=new Date(go.generatedAt||0).getTime(); const age=(Date.now()-t)/36e5
  if(!Number.isFinite(age)||age>maxAgeH) fail.push(`GO evidence is stale (${Number.isFinite(age)?age.toFixed(1):'unknown'}h)`)
}
let manifest
try{manifest=JSON.parse(fs.readFileSync('reports/release-manifest-v6.0.0.json','utf8'))}catch{fail.push('Run npm run release:manifest before launch')}
if(manifest){
  if(manifest.version!=='6.0.0') fail.push('Release manifest version mismatch')
  for(const e of manifest.files||[]){
    if(!fs.existsSync(e.file)){fail.push(`Manifest file missing: ${e.file}`);continue}
    const h=crypto.createHash('sha256').update(fs.readFileSync(e.file)).digest('hex')
    if(h!==e.sha256) fail.push(`Release file changed after manifest: ${e.file}`)
  }
}
const report={version:'6.0.0',checkedAt:new Date().toISOString(),passed:fail.length===0,failures:fail,warnings:warn}
fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/launch-guard.json',JSON.stringify(report,null,2))
console.log(`MELEO v6.0 launch guard: ${report.passed?'PASS':'FAIL'}`)
for(const x of fail) console.error('  ✗',x)
process.exitCode=report.passed?0:1
