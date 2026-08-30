# RC3-C2 HTTP Latency / Status / Request Metrics

Status: IMPLEMENTED — runtime staging proof pending

## Goal

Provide bounded-cardinality Prometheus-compatible HTTP request metrics for:

- request volume
- exact response status
- status family
- request latency distribution

## Existing foundation reused

RC3-C2 intentionally reuses the existing request completion hook in `server/relational/app.js`:

`observeRequest(req.method,res.statusCode,ms)`

and the existing protected `/api/metrics` route.

No second metrics middleware is introduced.

## Metrics

### Request counter

`meleo_http_requests_total`

Labels:

- `method`
- `status_code`
- `status_family`

No path, query string, request ID, user ID or other unbounded request-specific label is used.

### Request latency histogram

`meleo_http_request_duration_ms`

Buckets:

- 50 ms
- 100 ms
- 250 ms
- 500 ms
- 1000 ms
- 2500 ms
- 5000 ms
- +Inf

The exposition also includes histogram `_sum` and `_count`.

## Cardinality / privacy boundary

RC3-C2 deliberately excludes:

- URL path
- query parameters
- request IDs
- account/user identifiers
- booking identifiers
- message content
- headers
- cookies
- request bodies

This keeps cardinality bounded and avoids introducing sensitive request data into Prometheus labels.

## Regression guard

`scripts/http-metrics-selftest.mjs` verifies:

- 2xx/4xx/5xx exact status and status-family counters
- cumulative latency buckets
- +Inf bucket
- latency sum/count
- existing background-job counter compatibility
- existing extra gauges compatibility
- absence of path/query/requestId labels

The guard is wired into `ci:gate` as `http-metrics-check`.

## Runtime closure requirement

Before RC3-C2 is marked FULLY CLOSED, staging must prove that the protected `/api/metrics` endpoint exposes real request traffic with:

1. `meleo_http_requests_total` for a known 200 request
2. exact `status_code="200"` and `status_family="2xx"`
3. `meleo_http_request_duration_ms_bucket`
4. `meleo_http_request_duration_ms_sum`
5. `meleo_http_request_duration_ms_count`
6. no request-path/query/request-id labels in HTTP metrics

The metrics bearer token must remain secret and must not be copied into release evidence.

Until that runtime proof is recorded:

**RC3-C2: IMPLEMENTED / RUNTIME PROOF PENDING**