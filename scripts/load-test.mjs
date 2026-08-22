const base=process.env.BASE_URL||'http://localhost:8787'
const concurrency=Number(process.env.CONCURRENCY||25),rounds=Number(process.env.ROUNDS||10)
const urls=['/api/health','/api/professionals?limit=20','/api/professionals?specialty='+encodeURIComponent('Νοσηλευτική')+'&limit=20']
const lat=[];let errors=0
async function hit(i){const url=base+urls[i%urls.length],t=performance.now();try{const r=await fetch(url);if(!r.ok)errors++;await r.arrayBuffer()}catch{errors++}lat.push(performance.now()-t)}
for(let r=0;r<rounds;r++)await Promise.all(Array.from({length:concurrency},(_,i)=>hit(r*concurrency+i)))
lat.sort((a,b)=>a-b);const pct=p=>lat[Math.min(lat.length-1,Math.floor(lat.length*p))]||0
console.log(JSON.stringify({requests:lat.length,errors,p50:Math.round(pct(.50)),p95:Math.round(pct(.95)),p99:Math.round(pct(.99))},null,2))
if(errors)process.exitCode=1
