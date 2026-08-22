import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

const BASE=(process.env.BASE_URL||'http://localhost:8787').replace(/\/$/,'')
const CONCURRENCY=Math.max(1,Number(process.env.CONCURRENCY||25))
const DURATION_SECONDS=Math.max(2,Number(process.env.DURATION_SECONDS||20))
const WARMUP_SECONDS=Math.max(0,Number(process.env.WARMUP_SECONDS||3))
const P95_MAX_MS=Math.max(1,Number(process.env.P95_MAX_MS||500))
const ERROR_RATE_MAX=Math.max(0,Number(process.env.ERROR_RATE_MAX||0.01))
const MIN_RPS=Math.max(0,Number(process.env.MIN_RPS||10))
const METRICS_TOKEN=process.env.OBSERVABILITY_TOKEN||''
const REPORT_DIR=process.env.REPORT_DIR||'reports'

const scenarios=[
  {name:'health',weight:5,path:'/api/health'},
  {name:'config',weight:10,path:'/api/config'},
  {name:'professionals',weight:40,path:'/api/professionals?limit=20'},
  {name:'professionals_filtered',weight:30,path:'/api/professionals?specialty='+encodeURIComponent('Νοσηλευτική')+'&limit=20'},
  {name:'location_search',weight:10,path:'/api/location/search?q='+encodeURIComponent('Ηράκλειο')},
  {name:'seo_sitemap',weight:5,path:'/sitemap.xml'}
]
const weighted=scenarios.flatMap(s=>Array.from({length:s.weight},()=>s))
const rows=[]
const statusCounts={}
const scenarioStats=Object.fromEntries(scenarios.map(s=>[s.name,{requests:0,errors:0,latencies:[]}]))
let totalBytes=0
let stopAt=0

function percentile(values,p){if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor((a.length-1)*p))]}
function summarize(values){return {p50:+percentile(values,.50).toFixed(1),p95:+percentile(values,.95).toFixed(1),p99:+percentile(values,.99).toFixed(1),max:+(values.length?Math.max(...values):0).toFixed(1)}}
async function oneHit(s,record=true){
  const t=performance.now();let status=0,bytes=0,error=''
  try{const r=await fetch(BASE+s.path,{headers:{accept:'application/json,text/plain,*/*','cache-control':'no-cache'}});status=r.status;const b=await r.arrayBuffer();bytes=b.byteLength;if(!r.ok)error=`HTTP ${r.status}`}
  catch(e){error=e?.message||String(e)}
  const ms=performance.now()-t
  if(record){
    rows.push(ms);totalBytes+=bytes;statusCounts[status||'network_error']=(statusCounts[status||'network_error']||0)+1
    const st=scenarioStats[s.name];st.requests++;st.latencies.push(ms);if(error)st.errors++
  }
}
async function worker(){let i=Math.floor(Math.random()*weighted.length);while(performance.now()<stopAt){const s=weighted[i++%weighted.length];await oneHit(s,true)}}
async function warmup(){if(!WARMUP_SECONDS)return;const until=performance.now()+WARMUP_SECONDS*1000;while(performance.now()<until)await Promise.all(Array.from({length:Math.min(CONCURRENCY,10)},(_,i)=>oneHit(weighted[i%weighted.length],false)))}
async function getMetrics(){if(!METRICS_TOKEN)return null;try{const r=await fetch(BASE+'/api/metrics',{headers:{authorization:`Bearer ${METRICS_TOKEN}`}});return r.ok?await r.text():null}catch{return null}}
function metric(text,name){if(!text)return null;const m=text.match(new RegExp(`^${name}\\s+([0-9.eE+-]+)$`,'m'));return m?Number(m[1]):null}

console.log(`MELEO v5.5 load test → ${BASE}`)
console.log(`warmup=${WARMUP_SECONDS}s duration=${DURATION_SECONDS}s concurrency=${CONCURRENCY}`)
await warmup()
const before=await getMetrics();const started=performance.now();stopAt=started+DURATION_SECONDS*1000
await Promise.all(Array.from({length:CONCURRENCY},()=>worker()))
const elapsed=(performance.now()-started)/1000;const after=await getMetrics()
const errors=Object.values(scenarioStats).reduce((n,s)=>n+s.errors,0)
const requests=rows.length;const rps=requests/elapsed;const errorRate=requests?errors/requests:1
const latency=summarize(rows)
const byScenario=Object.fromEntries(Object.entries(scenarioStats).map(([k,s])=>[k,{requests:s.requests,errors:s.errors,errorRate:s.requests?+(s.errors/s.requests).toFixed(4):0,...summarize(s.latencies)}]))
const db={
  poolTotal:metric(after,'meleo_postgres_pool_total'),poolIdle:metric(after,'meleo_postgres_pool_idle'),poolWaiting:metric(after,'meleo_postgres_pool_waiting'),
  jobsPending:metric(after,'meleo_background_jobs_pending'),jobsProcessing:metric(after,'meleo_background_jobs_processing'),jobsFailed:metric(after,'meleo_background_jobs_failed')
}
const thresholds={p95:{limit:P95_MAX_MS,value:latency.p95,pass:latency.p95<=P95_MAX_MS},errorRate:{limit:ERROR_RATE_MAX,value:+errorRate.toFixed(4),pass:errorRate<=ERROR_RATE_MAX},rps:{minimum:MIN_RPS,value:+rps.toFixed(2),pass:rps>=MIN_RPS}}
const pass=Object.values(thresholds).every(x=>x.pass)
const report={version:'5.6.0',timestamp:new Date().toISOString(),base:BASE,config:{concurrency:CONCURRENCY,durationSeconds:DURATION_SECONDS,warmupSeconds:WARMUP_SECONDS},summary:{requests,errors,errorRate:+errorRate.toFixed(4),rps:+rps.toFixed(2),throughputMbps:+((totalBytes*8/elapsed)/1_000_000).toFixed(3),...latency},statusCounts,byScenario,database:db,metricsDelta:before&&after?{available:true}: {available:false},thresholds,pass}
fs.mkdirSync(REPORT_DIR,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-');const file=path.join(REPORT_DIR,`load-${stamp}.json`);fs.writeFileSync(file,JSON.stringify(report,null,2));fs.writeFileSync(path.join(REPORT_DIR,'load-latest.json'),JSON.stringify(report,null,2))
console.log(JSON.stringify(report,null,2));console.log(`Report: ${file}`)
if(!pass)process.exitCode=1
