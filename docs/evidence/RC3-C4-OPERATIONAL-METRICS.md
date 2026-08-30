# RC3-C4 Operational Dependency Metrics

Status: IMPLEMENTED — staging runtime proof pending.

Adds bounded metrics for PostgreSQL, Redis, background-worker liveness/queue health,
and Stripe subscription/reconciliation state.

No PII, booking IDs, Stripe IDs, raw errors, or unbounded labels are exported.
Stripe metrics are derived from local MELEO state and reconciliation jobs; metrics
scrapes do not call Stripe directly. Worker liveness is shared through a short-lived
Redis heartbeat. No database migration is required.

Runtime closure requires protected staging /api/metrics evidence showing PostgreSQL
up, Redis configured/up, worker up with a fresh heartbeat, Stripe configured, and
finite reconciliation/latency gauges.
