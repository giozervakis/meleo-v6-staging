import assert from 'node:assert/strict'
import { observeRequest, observeJob, metricsText } from '../server/metrics.js'

observeRequest('GET',200,12.5)
observeRequest('GET',404,80)
observeRequest('POST',500,620)
observeJob('completed')

const text=metricsText({
  postgres_pool_total:3
})

const has=line=>text.split('\n').includes(line)

assert.equal(
  has('meleo_http_requests_total{method="GET",status_code="200",status_family="2xx"} 1'),
  true
)
assert.equal(
  has('meleo_http_requests_total{method="GET",status_code="404",status_family="4xx"} 1'),
  true
)
assert.equal(
  has('meleo_http_requests_total{method="POST",status_code="500",status_family="5xx"} 1'),
  true
)

assert.equal(has('meleo_http_request_duration_ms_bucket{le="50"} 1'),true)
assert.equal(has('meleo_http_request_duration_ms_bucket{le="100"} 2'),true)
assert.equal(has('meleo_http_request_duration_ms_bucket{le="500"} 2'),true)
assert.equal(has('meleo_http_request_duration_ms_bucket{le="1000"} 3'),true)
assert.equal(has('meleo_http_request_duration_ms_bucket{le="+Inf"} 3'),true)
assert.equal(has('meleo_http_request_duration_ms_sum 712.500'),true)
assert.equal(has('meleo_http_request_duration_ms_count 3'),true)

assert.equal(has('meleo_background_jobs_total{outcome="completed"} 1'),true)
assert.equal(has('meleo_postgres_pool_total 3'),true)

assert.match(text,/# TYPE meleo_http_requests_total counter/)
assert.match(text,/# TYPE meleo_http_request_duration_ms histogram/)

assert.doesNotMatch(text,/path=/)
assert.doesNotMatch(text,/query=/)
assert.doesNotMatch(text,/requestId=/)

console.log('RC3-C2 HTTP metrics self-test: PASS')