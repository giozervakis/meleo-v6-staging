# RC3-C5 Uptime, Alerting and Readiness Hardening

Status: IMPLEMENTED - staging runtime proof pending.

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
