import fs from 'node:fs'
const maxAgeH=Number(process.env.RELEASE_EVIDENCE_MAX_AGE_HOURS||72)
const items=[
 ['production preflight','reports/release-preflight.json'],['TLS/domain','reports/tls-readiness.json'],['Stripe','reports/stripe-readiness.json'],['database backup','reports/backup-latest.json'],['restore drill','reports/restore-drill.json'],['critical E2E','reports/e2e-critical-latest.json']
]
const results=[]
for(const [name,file] of items){
 try{const x=JSON.parse(fs.readFileSync(file,'utf8')); const t=new Date(x.checkedAt||x.createdAt||x.generatedAt||0).getTime(); const age=(Date.now()-t)/36e5; const pass=Boolean(x.passed ?? (x.failed===0)); results.push({name,file,pass,ageHours:Number(age.toFixed(1)),fresh:age<=maxAgeH})}
 catch{results.push({name,file,pass:false,fresh:false,missing:true})}
}
const blockers=results.filter(x=>!x.pass||!x.fresh)
const report={version:'6.1.2',generatedAt:new Date().toISOString(),decision:blockers.length?'NO-GO':'GO',results,blockers}
fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/release-go-no-go.json',JSON.stringify(report,null,2)); console.table(results); console.log(`\nMELEO v6.0 RELEASE DECISION: ${report.decision}`); process.exitCode=blockers.length?1:0
