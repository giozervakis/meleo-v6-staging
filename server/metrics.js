const started=Date.now()
const counters=new Map(), durations=new Map()
const inc=(k,n=1)=>counters.set(k,(counters.get(k)||0)+n)
export function observeRequest(method,status,durationMs){
  const family=status>=500?'5xx':status>=400?'4xx':status>=300?'3xx':'2xx'
  inc(`http_requests_total{method="${method}",status_family="${family}"}`)
  inc('http_request_duration_ms_sum',durationMs)
  inc('http_request_duration_ms_count',1)
}
export function observeJob(outcome){inc(`background_jobs_total{outcome="${outcome}"}`)}
export function metricsText(extra={}){
  const lines=['# HELP meleo_uptime_seconds Process uptime.','# TYPE meleo_uptime_seconds gauge',`meleo_uptime_seconds ${Math.floor((Date.now()-started)/1000)}`]
  for(const [k,v] of counters)lines.push(`meleo_${k} ${Number(v).toFixed(k.includes('_ms_sum')?3:0)}`)
  for(const [k,v] of Object.entries(extra))lines.push(`meleo_${k} ${Number(v)||0}`)
  return lines.join('\n')+'\n'
}
export const metricInc=inc
