import assert from 'node:assert/strict'
import { createHttpErrorHandler } from '../server/error-observability.js'
import { observeError, metricsText } from '../server/metrics.js'

const events=[]
const log={
  warn:(event,meta)=>events.push({level:'warn',event,meta}),
  error:(event,meta)=>events.push({level:'error',event,meta})
}
const makeRes=()=>({
  headersSent:false,
  statusCode:200,
  body:null,
  status(code){this.statusCode=code;return this},
  json(body){this.body=body;return this}
})
const handler=createHttpErrorHandler({log,observeError})

const r1=makeRes()
handler(
  new Error('RAW_ERROR_SHOULD_NOT_LEAK'),
  {
    requestId:'c3-selftest-id',
    method:'POST',
    path:'/api/private-test',
    headers:{authorization:'Bearer SHOULD_NOT_LEAK',cookie:'SHOULD_NOT_LEAK'},
    body:{password:'SHOULD_NOT_LEAK'}
  },
  r1,
  ()=>{}
)
assert.equal(r1.statusCode,500)
assert.deepEqual(r1.body,{error:'Εσωτερικό σφάλμα. Δοκίμασε ξανά.'})

const r2=makeRes()
const big=new Error('too large')
big.type='entity.too.large'
handler(big,{requestId:'c3-large-id',method:'POST',path:'/api/upload'},r2,()=>{})
assert.equal(r2.statusCode,413)

const r3=makeRes()
const bad=new Error('internal detail')
bad.status=400
handler(bad,{requestId:'c3-bad-id',method:'GET',path:'/api/bad'},r3,()=>{})
assert.equal(r3.statusCode,400)

const serialized=JSON.stringify(events)
assert.doesNotMatch(serialized,/SHOULD_NOT_LEAK|RAW_ERROR_SHOULD_NOT_LEAK|internal detail/)
assert.equal(events.some(x=>x.event==='http.unhandled_error'&&x.meta.requestId==='c3-selftest-id'),true)
assert.equal(events.some(x=>x.event==='http.payload_too_large'&&x.meta.requestId==='c3-large-id'),true)
assert.equal(events.some(x=>x.event==='http.request_error'&&x.meta.statusCode===400),true)

const out=metricsText()
assert.match(out,/meleo_application_errors_total\{source="http",kind="unhandled"\} 1/)
assert.match(out,/meleo_application_errors_total\{source="http",kind="payload_too_large"\} 1/)
assert.match(out,/meleo_application_errors_total\{source="http",kind="request_error"\} 1/)
assert.match(out,/# TYPE meleo_application_errors_total counter/)
console.log('RC3-C3 error observability self-test: PASS')
