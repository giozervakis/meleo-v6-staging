# RC3-C1 Request Observability — Runtime Evidence

Status: FULLY CLOSED

## Scope

RC3-C1 establishes request correlation and structured HTTP request lifecycle logging for the MELEO staging API.

Implementation chain:

- `0a5ff1fd7b740dff5672967bcfb297f2f86bc0bb` — add request correlation logging
- `eb8e1ddcff01069acb4e7e5a9c8b0a83efd9a466` — repair middleware startup syntax
- `5d91b1184a09a7756c29a1e415f9a9e4f088ac5b` — remove duplicate legacy request-correlation middleware

## Static / CI evidence

The implementation passed:

- JavaScript syntax validation
- dedicated request-observability self-test
- `git diff --check`
- full `npm run ci:gate`
- `npm run build`
- exact changed-file guards
- clean working tree / origin-main parity after push

## Live staging runtime evidence

Target:

`https://meleo-v6-staging.onrender.com/api/health`

### Generated request ID

A request without `X-Request-Id` returned:

- HTTP status: `200`
- response `X-Request-Id`: `fc82c5ec-17df-4941-be10-f46610231808`

This proves the middleware generates a request correlation identifier when the client does not provide one.

### Caller-provided request ID

A request with:

`X-Request-Id: meleo-c1-proof-123456`

returned:

- HTTP status: `200`
- response `X-Request-Id`: `meleo-c1-proof-123456`

This proves a valid caller-supplied correlation identifier is preserved and echoed.

### Render structured log correlation

Render staging emitted:

```json
{"ts":"2026-08-30T08:45:26.525Z","level":"info","event":"http.request.started","service":"meleo","instance":"render-staging-api","requestId":"meleo-c1-proof-123456","method":"GET","path":"/api/health"}
```

and:

```json
{"ts":"2026-08-30T08:45:26.526Z","level":"info","event":"http.request.completed","service":"meleo","instance":"render-staging-api","requestId":"meleo-c1-proof-123456","method":"GET","path":"/api/health","statusCode":200,"durationMs":1.6,"outcome":"finished"}
```

The same request ID is present in both lifecycle records.

The completed event includes:

- `statusCode: 200`
- `durationMs: 1.6`
- `outcome: finished`

Additional Render health-check traffic showed repeated generated request IDs with matching started/completed events and successful HTTP 200 completion.

## Privacy / sensitive-data boundary

The runtime evidence records only request metadata needed for correlation and request lifecycle diagnostics:

- request ID
- method
- normalized path
- response status
- duration
- outcome
- service / instance metadata

The observed runtime records do not contain:

- request bodies
- passwords
- Authorization headers
- cookies
- Stripe secrets
- query-string values
- user message content

## Result

RC3-C1 acceptance criteria are satisfied:

1. Missing request ID generates a response correlation ID — PASS
2. Valid supplied request ID is echoed — PASS
3. Structured `http.request.started` event emitted — PASS
4. Structured `http.request.completed` event emitted — PASS
5. Same request ID correlates start/completion — PASS
6. Completion includes status and duration — PASS
7. Live staging request returns HTTP 200 — PASS
8. No sensitive request payload observed in lifecycle logs — PASS

**RC3-C1: FULLY CLOSED**