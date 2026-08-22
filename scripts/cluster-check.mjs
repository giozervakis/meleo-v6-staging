// Verifies that requests through the public load balancer reach more than one app instance.
const base=(process.env.BASE_URL||'http://localhost:8787').replace(/\/$/,'')
const attempts=Math.max(6,Number(process.env.ATTEMPTS||18))
const seen=new Map();let failures=0
for(let i=0;i<attempts;i++){
  try{
    const r=await fetch(base+'/api/health',{headers:{'cache-control':'no-cache'}})
    if(!r.ok){failures++;continue}
    const j=await r.json();const id=j.instance||'unknown';seen.set(id,(seen.get(id)||0)+1)
  }catch{failures++}
}
console.log(JSON.stringify({base,attempts,failures,instances:Object.fromEntries(seen),instanceCount:seen.size},null,2))
if(failures)process.exitCode=1
if(process.env.REQUIRE_MULTI_INSTANCE==='1'&&seen.size<2){console.error('Expected at least 2 application instances behind the load balancer.');process.exitCode=1}
