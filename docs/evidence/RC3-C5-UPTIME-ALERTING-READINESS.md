# RC3-C5 Uptime, Alerting and Readiness Hardening

Status: FULLY CLOSED.

RC3-C5 separates process liveness from dependency readiness and adds bounded alert
signals derived from RC3-C4 operational metrics.

`GET /api/liveness` is intentionally cheap and dependency-free.

`GET /api/ready` fails closed with HTTP 503 while draining or when a critical
dependency is unavailable. Hosted readiness includes PostgreSQL, required Redis,
worker heartbeat, and production-only object storage, payments, mail, and admin 2FA.

Protected `/api/metrics` exposes explicit alert gauges for database down, Redis down,
worker down, failed background jobs, queue backlog over 300 seconds, Stripe
reconciliation failure, Stripe reconciliation staleness over 7200 seconds, plus
`meleo_alert_active_total`.

These are alert signals and thresholds. External paging/notification delivery is not
claimed by this implementation.

Render health checking is moved from `/api/health` to `/api/ready`.

Runtime closure requires staging proof that liveness is 200/live, readiness is
200/ready, critical checks are true, alert gauges are present, and healthy staging has
`meleo_alert_active_total 0`.
## Staging runtime evidence - 2026-08-30

Liveness:
- HTTP 200
- state: live
- instance: render-staging-api

Readiness:
- HTTP 200
- state: ready
- database: true
- redis: true
- worker: true
- objectStorage: true
- payments: true
- mail: true
- admin2fa: true
- criticalFailures: []

Protected alert metrics:
- meleo_alert_database_down 0
- meleo_alert_redis_down 0
- meleo_alert_worker_down 0
- meleo_alert_queue_failed 0
- meleo_alert_queue_backlog 0
- meleo_alert_stripe_reconcile_failed 0
- meleo_alert_stripe_reconcile_stale 0
- meleo_alert_active_total 0

Runtime acceptance:
- process liveness: PASS
- dependency readiness: PASS
- worker readiness: PASS
- bounded alert gauges: PASS
- healthy staging active alerts: 0

## Closure

RC3-C5 is FULLY CLOSED for liveness/readiness separation, fail-closed readiness,
bounded alert signals, Render readiness health checking, CI regression coverage,
and staging runtime validation.

Evidence boundary: this implementation provides alert signals and thresholds only.
It does not claim external pager/email/SMS alert delivery.
