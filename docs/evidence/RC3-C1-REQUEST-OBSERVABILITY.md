# RC3-C1 — Request IDs + Structured JSON Request Logging

Status: **IMPLEMENTED / STATIC PASS — STAGING RUNTIME PROOF NEXT**

Release: `meleo-production-architecture@7.0.0-rc.2`

## Existing foundation

MELEO already had a structured JSON logger and a validated request-ID generator in `server/logger.js`.

The logger emits JSON records with timestamp, level, event, service and instance metadata.

The request-ID helper preserves a safe incoming identifier and generates a UUID when the incoming value is missing or invalid.

## RC3-C1 implementation

A dedicated `server/request-observability.js` Express middleware now:

- reads an incoming `X-Request-Id`;
- validates it through the existing request-ID helper;
- generates a UUID when necessary;
- exposes the identifier as both `req.id` and `req.requestId`;
- returns the identifier in the `X-Request-Id` response header;
- emits `http.request.started`;
- emits exactly one terminal `http.request.completed` event;
- records method, normalized path, HTTP status, duration and completion outcome;
- uses INFO for successful responses, WARN for 4xx and ERROR for 5xx;
- records aborted connections without double-emitting completion logs.

The middleware is installed globally in the PostgreSQL relational application immediately after Express application creation.

## Privacy boundary

The request log deliberately does not record:

- request bodies;
- passwords;
- authorization headers;
- cookies;
- Stripe secrets;
- query-string values;
- patient/professional message content.

The request identifier is operational correlation metadata, not an authentication credential.

## Regression protection

`request-observability-check` validates:

- valid incoming request-ID preservation;
- invalid request-ID replacement;
- response correlation header;
- request start/completion events;
- latency/status/outcome fields;
- global relational-app middleware registration.

The check is appended to `ci:gate`.

## Runtime acceptance still required

After deployment to Render staging, RC3-C1 should be considered runtime-proven only after confirming:

1. a request with no `X-Request-Id` returns a generated `X-Request-Id`;
2. a request with a valid caller-provided `X-Request-Id` echoes the same ID;
3. Render logs contain `http.request.started` and `http.request.completed` with the same ID;
4. the completed log contains status code and duration;
5. no request body, authorization header, cookie, or secret appears in those records.

## Verdict

**RC3-C1 implementation: PASS**

**RC3-C1 runtime evidence: PENDING STAGING DEPLOYMENT**