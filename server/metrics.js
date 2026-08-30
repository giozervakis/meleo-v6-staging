const started=Date.now()

const counters=new Map()
const durationBucketsMs=[50,100,250,500,1000,2500,5000]
const durationBuckets=new Map(durationBucketsMs.map(v=>[v,0]))
let durationInfinity=0
let durationSumMs=0
let durationCount=0

const inc=(k,n=1)=>counters.set(k,(counters.get(k)||0)+n)
const escLabel=value=>String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n')
const statusFamily=status=>status>=500?'5xx':status>=400?'4xx':status>=300?'3xx':status>=200?'2xx':'other'

export function observeRequest(method,status,durationMs){
  const safeMethod=String(method||'UNKNOWN').toUpperCase()
  const safeStatus=Number.isFinite(Number(status))?Math.trunc(Number(status)):0
  const family=statusFamily(safeStatus)
  const duration=Math.max(0,Number(durationMs)||0)

  inc(`http_requests_total{method="${escLabel(safeMethod)}",status_code="${safeStatus}",status_family="${family}"}`)

  durationCount+=1
  durationSumMs+=duration
  durationInfinity+=1

  for(const upperBound of durationBucketsMs){
    if(duration<=upperBound){
      durationBuckets.set(upperBound,(durationBuckets.get(upperBound)||0)+1)
    }
  }
}

export function observeJob(outcome){
  inc(`background_jobs_total{outcome="${escLabel(outcome)}"}`)
}

export function metricsText(extra={}){
  const lines=[
    '# HELP meleo_uptime_seconds Process uptime.',
    '# TYPE meleo_uptime_seconds gauge',
    `meleo_uptime_seconds ${Math.floor((Date.now()-started)/1000)}`,

    '# HELP meleo_http_requests_total HTTP requests partitioned by method, exact status code and status family.',
    '# TYPE meleo_http_requests_total counter'
  ]

  for(const [k,v] of counters){
    if(k.startsWith('http_requests_total{')){
      lines.push(`meleo_${k} ${Number(v).toFixed(0)}`)
    }
  }

  lines.push(
    '# HELP meleo_http_request_duration_ms HTTP request duration histogram in milliseconds.',
    '# TYPE meleo_http_request_duration_ms histogram'
  )

  for(const upperBound of durationBucketsMs){
    lines.push(`meleo_http_request_duration_ms_bucket{le="${upperBound}"} ${durationBuckets.get(upperBound)||0}`)
  }
  lines.push(`meleo_http_request_duration_ms_bucket{le="+Inf"} ${durationInfinity}`)
  lines.push(`meleo_http_request_duration_ms_sum ${durationSumMs.toFixed(3)}`)
  lines.push(`meleo_http_request_duration_ms_count ${durationCount}`)

  const otherCounters=[...counters.entries()].filter(([k])=>!k.startsWith('http_requests_total{'))
  if(otherCounters.length){
    lines.push(
      '# HELP meleo_background_jobs_total Background job outcomes.',
      '# TYPE meleo_background_jobs_total counter'
    )
    for(const [k,v] of otherCounters){
      lines.push(`meleo_${k} ${Number(v).toFixed(0)}`)
    }
  }

  for(const [k,v] of Object.entries(extra)){
    lines.push(`meleo_${k} ${Number(v)||0}`)
  }

  return lines.join('\n')+'\n'
}

export const metricInc=inc