# RC3-C3 Error Tracking / Error Observability

Status: IMPLEMENTED — runtime staging proof pending

RC3-C3 centralizes hosted HTTP error handling, correlates structured error events with RC3-C1 request IDs, and exports bounded application-error counters through RC3-C2 metrics.

Before RC3-C3, the Express error middleware was attached only to the non-hosted/no-dist branch. The centralized error handler is now installed independently of SPA static serving.

Structured events:
- `http.unhandled_error`
- `http.request_error`
- `http.payload_too_large`
- `http.error_after_headers`

The centralized HTTP error path excludes raw request bodies, authorization headers, cookies and raw error messages.

Metric:
`meleo_application_errors_total{source,kind}`

Existing `uncaughtException` and `unhandledRejection` shutdown behavior remains and now increments bounded process error counters.

Runtime staging proof is still required before RC3-C3 can be marked FULLY CLOSED.
