# RC3-C2 HTTP Latency / Status / Request Metrics — Runtime Evidence

Status: FULLY CLOSED

## Implementation

Implementation commit:

`dc17e9f4618d34dbecee55d1906385bd8752d195`

Commit message:

`feat(observability): add HTTP request latency metrics`

RC3-C2 reuses the existing request completion hook and protected `/api/metrics` endpoint rather than introducing a duplicate metrics middleware.

## Runtime environment

Environment:

`staging`

Service:

`MELEO Render staging API`

Protected metrics endpoint:

`/api/metrics`

Authentication:

Bearer token via `OBSERVABILITY_TOKEN`.

The token value is intentionally excluded from this evidence.

## Runtime access proof

Authenticated request to `/api/metrics` returned:

`HTTP 200`

This proves the protected metrics endpoint was reachable with valid authorization.

## Runtime HTTP request metrics proof

Observed:

```text
meleo_http_requests_total{method="HEAD",status_code="200",status_family="2xx"} 1
meleo_http_requests_total{method="GET",status_code="200",status_family="2xx"} 58
meleo_http_requests_total{method="GET",status_code="404",status_family="4xx"} 2
```

This demonstrates runtime collection of:

- request method
- exact HTTP response status
- response status family
- multiple status outcomes

## Runtime latency histogram proof

Observed:

```text
meleo_http_request_duration_ms_bucket{le="50"} 61
meleo_http_request_duration_ms_bucket{le="100"} 61
meleo_http_request_duration_ms_bucket{le="250"} 61
meleo_http_request_duration_ms_bucket{le="500"} 61
meleo_http_request_duration_ms_bucket{le="1000"} 61
meleo_http_request_duration_ms_bucket{le="2500"} 61
meleo_http_request_duration_ms_bucket{le="5000"} 61
meleo_http_request_duration_ms_bucket{le="+Inf"} 61
meleo_http_request_duration_ms_sum 122.821
meleo_http_request_duration_ms_count 61
```

This demonstrates live runtime exposure of:

- cumulative latency buckets
- +Inf bucket
- latency sum
- latency sample count

The observed bucket count and histogram count both equal `61`.

## Bounded-cardinality / privacy proof

The runtime HTTP metric labels contain only:

- `method`
- `status_code`
- `status_family`
- histogram boundary `le`

The observed HTTP metrics contain no:

- request path
- query parameters
- request ID
- user/account identifier
- booking identifier
- message content
- headers
- cookies
- request bodies

This preserves bounded cardinality and avoids exposing request-specific sensitive information through Prometheus labels.

## Regression protection

RC3-C2 includes:

`scripts/http-metrics-selftest.mjs`

and package script:

`http-metrics-check`

The guard is included in:

`ci:gate`

The implementation run completed successfully with:

- HTTP metrics self-test: PASS
- CI gate: PASS
- production client build: PASS
- exact staged-file guard: PASS
- clean working tree
- `origin/main` parity

## Acceptance criteria

1. Protected `/api/metrics` returns HTTP 200 with valid authorization: PASS
2. Runtime request counter exists: PASS
3. Exact HTTP status code label exists: PASS
4. HTTP status-family label exists: PASS
5. Request method label exists: PASS
6. Runtime latency histogram buckets exist: PASS
7. Histogram +Inf bucket exists: PASS
8. Histogram sum exists: PASS
9. Histogram count exists: PASS
10. Bounded-cardinality HTTP labels preserved: PASS
11. Sensitive request-specific labels absent: PASS
12. Regression guard wired into CI: PASS

## Security note

The observability bearer token must remain secret and is not recorded in this evidence.

A token value was exposed during interactive testing and should be rotated in the Render environment after this proof. The replacement token must not be committed to source control or copied into release evidence.

## Final verdict

**RC3-C2 — HTTP latency/status/request metrics: FULLY CLOSED**