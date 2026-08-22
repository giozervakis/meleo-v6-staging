# MELEO v6.0 — Production Launch

Η v6.0 είναι το frozen production launch release. Πριν από οποιοδήποτε deploy απαιτείται `npm run release:go-no-go`, μετά `npm run release:manifest` και τέλος `npm run release:launch-guard`. Δες `LAUNCH_RUNBOOK_v6.0.md`.

## v5.7 Production Release Candidate

Το v5.7 προσθέτει evidence-based production release gates. Δες `PRODUCTION_RELEASE_CANDIDATE_v5.7.md` και τρέξε `npm run release:preflight`, `npm run release:stripe`, `npm run release:tls`, `npm run backup:db`, `npm run restore:drill` και τέλος `npm run release:go-no-go`.


## v5.3 — Secure Object Storage

Production verification documents now use private S3-compatible object storage. Files remain AES-256-GCM encrypted before upload, while development retains a local encrypted-file driver. See `V5.3_RELEASE_NOTES.md` and `PRODUCTION_DEPLOY_v5.3.md`.

# MELEO v5.3 — Secure Object Storage

> v5.3 adds private S3-compatible encrypted verification-document storage on top of the v5.2 background jobs and observability architecture.

# MELEO v5.1 — Production Infrastructure

Η **MELEO** είναι multi-specialty marketplace για επαγγελματίες υγείας, φροντίδας και ευεξίας. Η v5.1 κρατά το relational data model της v5.0 και αναβαθμίζει το production deployment για horizontal scaling σε ένα server.

## Business model

- **BASIC — 9,99€/μήνα**
- **PREMIUM — 14,99€/μήνα**, με σαφή εμπορική σήμανση «Προτεινόμενος»
- Οι συνοδοί/ασθενείς χρησιμοποιούν τη MELEO δωρεάν.
- Η MELEO δεν κρατά προμήθεια από την επίσκεψη.
- **MELEO Verified** και **Premium/Recommended** είναι ανεξάρτητες έννοιες.

## Τι νέο φέρνει η v5.1

- Relational PostgreSQL schema με πραγματικά tables/FKs/indexes.

- 3 Node application instances πίσω από nginx `least_conn` load balancer.
- Redis 7.4 για distributed rate limiting και hot geocoding cache.
- PostgreSQL fallback αν το Redis παρουσιάσει προσωρινή βλάβη.
- `/api/health` με instance ID και `/api/ready` με Redis readiness.
- Χωρίς `meleo_docs` και χωρίς global write lock στο production backend.
- Paginated search/admin/bookings/notifications.
- PostgreSQL sessions και distributed rate limiting.
- Async password hashing.
- PostgreSQL LISTEN/NOTIFY για multi-instance live notifications/chat events.
- Daily aggregated professional analytics.
- Persistent geocoding cache + Mapbox-ready provider.
- Encrypted verification uploads με persistent Docker volume.
- Central booking authorization helpers.
- Deep links/back button με History API routing.
- Sitemap, robots, SEO metadata, structured profile data και location/specialty landing pages.
- Legacy v4 JSON → v5 migration script.

## Γρήγορο local preview

Χωρίς `DATABASE_URL` το development mode κρατά το παλιό local demo backend για να ανοίγει αμέσως:

```bash
npm ci
npm run dev
```

Frontend: `http://localhost:5173`  
API: `http://localhost:8787`

## Relational development mode

Με Docker:

```bash
npm ci
npm run dev:stack
```

Σε δεύτερο PowerShell:

```bash
npm run dev:web
```

Το relational API είναι στο `http://localhost:8787`, η PostgreSQL στο local port `54329` και το Redis στο `63799`.

Demo accounts:

| Ρόλος | Email | Κωδικός |
|---|---|---|
| Συνοδός/ασθενής | `patient@meleo.gr` | `demo123` |
| BASIC επαγγελματίας | `nikos@meleo.gr` | `demo123` |
| PREMIUM επαγγελματίας | `maria@meleo.gr` | `demo123` |
| Admin | `admin@meleo.gr` | `admin123` |

## Production

```bash
cp .env.example .env
# συμπλήρωσε production secrets
npm ci
npm run build
npm start
```

ή:

```bash
# Δες πρώτα PRODUCTION_DEPLOY_v5.1.md για το πρώτο TLS certificate
docker compose up -d --build
```

Σε production το `DATABASE_URL` είναι υποχρεωτικό. Δεν επιτρέπεται fallback στο JSON backend.

## Migration από v4.x local database

```bash
DATABASE_URL=postgres://... npm run migrate:legacy
```

ή:

```bash
LEGACY_JSON=C:\path\to\db.json DATABASE_URL=postgres://... npm run migrate:legacy
```

Κράτησε backup πριν migration.

## Validation

```bash
npm run architecture-check
npm run security-selftest
npm run build
npm run loadtest
```

Περισσότερα: **PRODUCTION_ARCHITECTURE_v5.md** και **V5_RELEASE_NOTES.md**.


## v5.1 deployment

Για production multi-instance εγκατάσταση, TLS bootstrap, Redis, health checks, rolling update και rollback, δες `PRODUCTION_DEPLOY_v5.1.md`.

## v5.5 Frontend code splitting
Η v5.5 μεταφέρει τα βαριά Admin, Professional, Support και Account/Legal domains σε route-level lazy chunks. Έλεγχος αρχιτεκτονικής: `npm run frontend-architecture-check`.


## v5.5 Quality Gates
- `npm run e2e` — critical end-to-end flows
- `npm run loadtest` — mixed traffic baseline with p95/error/RPS gates
- `npm run loadtest:stages` — stress ladder
- `npm run e2e:browser` — optional Playwright browser suite

See `PRODUCTION_TESTING_v5.5.md`.

## v5.7 Security / CI gate
Run `npm run v56-check`, `npm run security:secrets`, and `npm run ci:gate`. GitHub Actions workflow: `.github/workflows/quality-gate.yml`.
