# MELEO v5.2 — deployment delta

1. Copy `.env.example` to the production secret store and set `OBSERVABILITY_TOKEN` to a long random value.
2. `docker compose build --no-cache`
3. `docker compose up -d`
4. Confirm `docker compose ps` shows db, redis, app1, app2, app3, worker and nginx.
5. Test readiness: `curl https://meleo.gr/api/ready`
6. Test metrics: `curl -H "Authorization: Bearer $OBSERVABILITY_TOKEN" https://meleo.gr/api/metrics`
7. Trigger a password-reset or registration email; confirm the job goes pending -> processing -> completed.
8. Check queue: `docker compose exec app1 npm run queue-check`.

Failed jobs remain in `background_jobs` with status `failed` and `last_error`; they are not deleted, so delivery failures are auditable.
