import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root=process.cwd()
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const baseUrl=String(process.env.MELEO_STAGING_URL||'https://meleo-v6-staging.onrender.com').trim().replace(/\/+$/,'')
const databaseUrl=String(process.env.DATABASE_URL||'').trim()
const nodeEnv=String(process.env.NODE_ENV||'').trim().toLowerCase()

if(nodeEnv!=='staging'){
  console.error('RC3-B1 requires NODE_ENV=staging.')
  process.exit(2)
}
if(!databaseUrl){
  console.error('RC3-B1 requires DATABASE_URL for staging PostgreSQL.')
  process.exit(2)
}
if(!/^https:\/\//i.test(baseUrl)){
  console.error('RC3-B1 requires HTTPS MELEO_STAGING_URL.')
  process.exit(2)
}

function git(args){
  try{return execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()}
  catch{return 'unknown'}
}

function runNode(name,script,kind='invariant'){
  const started=Date.now()
  try{
    const output=execFileSync(process.execPath,[script],{env:process.env,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:10*1024*1024})
    return {name,kind,status:'PASS',durationMs:Date.now()-started,output:output.trim()}
  }catch(error){
    return {name,kind,status:'FAIL',durationMs:Date.now()-started,output:[error?.stdout,error?.stderr,error?.message].filter(Boolean).map(String).join('\n')}
  }
}

function percentile(values,p){
  if(!values.length)return 0
  const sorted=[...values].sort((a,b)=>a-b)
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil((p/100)*sorted.length)-1))]
}

async function requestOnce(url){
  const started=performance.now()
  try{
    const response=await fetch(url,{headers:{'user-agent':'MELEO-RC3-B1-runtime-evidence'}})
    const durationMs=performance.now()-started
    await response.arrayBuffer().catch(()=>{})
    return {status:response.status,durationMs,transportError:null}
  }catch(error){
    return {status:0,durationMs:performance.now()-started,transportError:error?.message||String(error)}
  }
}

async function phase(name,pathname,requests,concurrency){
  const timings=[]
  let cursor=0,http5xx=0,transportErrors=0,otherErrors=0
  async function worker(){
    while(true){
      const i=cursor++
      if(i>=requests)return
      const r=await requestOnce(`${baseUrl}${pathname}`)
      timings.push(r.durationMs)
      if(r.transportError)transportErrors++
      else if(r.status>=500)http5xx++
      else if(r.status>=400)otherErrors++
    }
  }
  await Promise.all(Array.from({length:Math.min(concurrency,requests)},()=>worker()))
  const avg=timings.reduce((a,b)=>a+b,0)/(timings.length||1)
  const p95=percentile(timings,95),p99=percentile(timings,99)
  const failureRate=((http5xx+transportErrors)/requests)*100
  const status=(http5xx||transportErrors||failureRate>2||p95>5000)?'FAIL':((p95>2500||p99>5000)?'PASS_WITH_WARNING':'PASS')
  return {name,kind:'live-http',status,path:pathname,requests,concurrency,http5xx,transportErrors,otherErrors,failureRatePct:+failureRate.toFixed(2),avgMs:+avg.toFixed(1),p95Ms:+p95.toFixed(1),p99Ms:+p99.toFixed(1)}
}

const checks=[
  runNode('migration-runner-selftest','scripts/migration-runner-selftest.mjs'),
  runNode('concurrent-double-booking','scripts/booking-concurrency-test.mjs','live-postgresql'),
  runNode('booking-list-nplus1','scripts/booking-list-nplus1-selftest.mjs'),
  runNode('gdpr-lifecycle-invariants','scripts/gdpr-account-selftest.mjs'),
  runNode('authorization-stripe-invariants','scripts/authorization-stripe-selftest.mjs'),
  runNode('database-tls-invariants','scripts/database-tls-selftest.mjs')
]

const httpPhases=[]
for(const spec of [
  ['health-c1','/api/health',12,1],
  ['health-c4','/api/health',16,4],
  ['health-c8','/api/health',16,8],
  ['config-c4','/api/config',16,4],
  ['plans-c4','/api/plans',16,4]
]) httpPhases.push(await phase(...spec))

const failures=[...checks,...httpPhases].filter(x=>x.status==='FAIL')
const evidence={
  product:'MELEO',release:pkg.version,suite:'RC3-B1',generatedAt:new Date().toISOString(),
  commit:git(['rev-parse','HEAD']),branch:git(['branch','--show-current']),
  environment:{nodeEnv,baseUrl,databaseConfigured:Boolean(databaseUrl)},checks,httpPhases,
  scope:{
    liveCoverage:['PostgreSQL concurrent double-booking protection','public staging HTTP health/config/plans bounded load'],
    invariantCoverage:['migration runner ledger/lock/checksum behavior','booking-list bounded query shape','GDPR lifecycle source invariants','authorization and Stripe webhook source invariants','PostgreSQL TLS source invariants'],
    notYetFreshLiveCoverage:['authenticated authorization matrix','GDPR export/deletion lifecycle through staging API','signed Stripe webhook duplicate/stale ordering through staging API','authenticated booking-list HTTP load'],
    note:'Static/self-test invariants are not represented as fresh credentialed runtime evidence.'
  },
  verdict:failures.length?'FAIL':'PARTIAL_PASS_AWAITING_CREDENTIALED_RUNTIME'
}

const dir=path.join(root,'reports','runtime-evidence')
fs.mkdirSync(dir,{recursive:true})
const stamp=evidence.generatedAt.replace(/[:.]/g,'-')
const jsonPath=path.join(dir,`RC3-B1-${stamp}.json`)
const mdPath=jsonPath.replace(/\.json$/,'.md')
fs.writeFileSync(jsonPath,JSON.stringify(evidence,null,2))
const md=[
  '# MELEO RC3-B1 Runtime Evidence','',
  `- Release: \`${evidence.release}\``,`- Commit: \`${evidence.commit}\``,`- Generated: \`${evidence.generatedAt}\``,`- Verdict: **${evidence.verdict}**`,'',
  '## Checks','', '| Check | Kind | Status | Duration |','|---|---|---:|---:|',
  ...checks.map(x=>`| ${x.name} | ${x.kind} | ${x.status} | ${x.durationMs} ms |`),'',
  '## Bounded HTTP phases','', '| Phase | Requests | C | 5xx | Transport | Avg | p95 | p99 | Status |','|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...httpPhases.map(x=>`| ${x.name} | ${x.requests} | ${x.concurrency} | ${x.http5xx} | ${x.transportErrors} | ${x.avgMs} ms | ${x.p95Ms} ms | ${x.p99Ms} ms | ${x.status} |`),'',
  '## Scope','',
  'Fresh credentialed authorization, GDPR API lifecycle, signed Stripe webhook ordering, and authenticated booking-list load are still required for full RC3-B1 closure.','',
  'This bounded staging load is not a production capacity benchmark.',''
].join('\n')
fs.writeFileSync(mdPath,md)

console.log('\nMELEO RC3-B1 unified runtime evidence harness')
console.log('==============================================')
for(const x of checks) console.log(`${x.status.padEnd(18)} ${x.kind.padEnd(16)} ${x.name}`)
for(const x of httpPhases) console.log(`${x.status.padEnd(18)} live-http        ${x.name} p95=${x.p95Ms}ms p99=${x.p99Ms}ms`)
console.log(`\nEvidence JSON: ${path.relative(root,jsonPath)}`)
console.log(`Evidence MD  : ${path.relative(root,mdPath)}`)
console.log(`Verdict      : ${evidence.verdict}`)
if(failures.length)process.exit(1)
console.log('\nRC3-B1 HARNESS PASS. Credentialed staging runtime pass is still required for full closure.')