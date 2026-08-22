# MELEO v5.5 — Production-like Testing

## 1. Σήκωσε το relational development stack
`npm run dev:stack`

## 2. Critical E2E
`npm run e2e`

## 3. Baseline load
`CONCURRENCY=25 DURATION_SECONDS=30 npm run loadtest`

PowerShell:
`$env:CONCURRENCY=25; $env:DURATION_SECONDS=30; npm run loadtest`

## 4. Stress ladder
`npm run loadtest:stages`

PowerShell custom stages:
`$env:LOAD_STAGES="25,50,100,200"; $env:STAGE_DURATION_SECONDS=20; npm run loadtest:stages`

## 5. Browser E2E (προαιρετικό test dependency)
Για να μη μεγαλώσει το production dependency tree, το Playwright δεν είναι runtime dependency.

`npm install -D @playwright/test`
`npx playwright install chromium`
`npm run dev:web`
`npm run e2e:browser`

## Thresholds
- `P95_MAX_MS` default 500
- `ERROR_RATE_MAX` default 0.01
- `MIN_RPS` default 10

## Observability correlation
Αν οριστεί `OBSERVABILITY_TOKEN`, το load harness διαβάζει `/api/metrics` και συμπεριλαμβάνει PostgreSQL pool / background jobs στοιχεία στο report.
