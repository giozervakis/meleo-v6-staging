import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
const stages=(process.env.LOAD_STAGES||'10,25,50,100').split(',').map(Number).filter(n=>n>0)
const duration=process.env.STAGE_DURATION_SECONDS||'15';const results=[]
for(const c of stages){console.log(`\n=== MELEO load stage: concurrency ${c} ===`);const r=spawnSync(process.execPath,['scripts/load-test-v55.mjs'],{stdio:'inherit',env:{...process.env,CONCURRENCY:String(c),DURATION_SECONDS:duration,MIN_RPS:process.env.MIN_RPS||'0'}});let report=null;try{report=JSON.parse(fs.readFileSync('reports/load-latest.json','utf8'))}catch{};results.push({concurrency:c,exitCode:r.status,summary:report?.summary,thresholds:report?.thresholds,pass:report?.pass});if(r.status!==0&&process.env.STOP_ON_FAIL==='1')break}
fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/load-stages-latest.json',JSON.stringify({version:'5.6.0',timestamp:new Date().toISOString(),results},null,2));console.log('\n=== Stage summary ===');console.table(results.map(x=>({concurrency:x.concurrency,rps:x.summary?.rps,p95:x.summary?.p95,errorRate:x.summary?.errorRate,pass:x.pass})))
if(results.some(x=>x.exitCode!==0))process.exitCode=1
