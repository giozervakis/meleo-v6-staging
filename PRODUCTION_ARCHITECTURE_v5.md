# MELEO v5.1 — Production Architecture

Η v5.1 διατηρεί το relational data layer της v5.0 και προσθέτει production horizontal scaling χωρίς αλλαγή στο business flow.

## Data layer + production runtime

- **Relational PostgreSQL**: ξεχωριστοί πίνακες για users, professionals, sessions, bookings, messages, reviews, subscriptions, payments, notifications, verification, support, analytics και audit logs.
- **Χωρίς `meleo_docs` στο production backend** και χωρίς global advisory write lock.
- **Στοχευμένα SQL queries + indexes** αντί για φόρτωση ολόκληρης της βάσης στη RAM.
- **Pagination** στα public professionals, bookings, notifications και Admin lists.
- **Sessions στη PostgreSQL** με indexed token hash — δεν υπάρχει cap 20.000 sessions.
- **Redis distributed rate limiting** για τα hot request counters, με PostgreSQL fallback σε προσωρινή αστοχία Redis.
- **Async scrypt** στο relational backend ώστε login/register να μην μπλοκάρουν το Node event loop.
- **Postgres LISTEN/NOTIFY** για live events σε πολλά Node instances.
- **Daily aggregated professional analytics** αντί για scan όλων των raw events.
- **Redis hot geocoding cache + PostgreSQL durable cache** και provider abstraction (Mapbox production / Nominatim development fallback).
- **Encrypted verification files + Docker volume** ώστε τα έγγραφα να μην χάνονται σε rebuild.
- **Central authorization helpers** για booking access/reviews.
- **History API routing** με deep links/back button (`/professionals/:id`, `/search`, `/admin`, dashboards).
- **SEO surface**: sitemap, robots, server-injected metadata + structured data για public profiles και location/specialty landing pages.

## Δύο modes ανάπτυξης

### Γρήγορο UI demo χωρίς Docker

```bash
npm ci
npm run dev
```

Χωρίς `DATABASE_URL` το development mode χρησιμοποιεί το legacy local demo backend για γρήγορο preview.

### Πλήρες relational development stack

```bash
npm ci
npm run dev:stack
```

Αυτό εκκινεί PostgreSQL + Redis + relational MELEO API μέσω `docker-compose.dev.yml`. Το frontend τρέχει ξεχωριστά:

```bash
npm run dev:web
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:8787`

## Production

Με `NODE_ENV=production` η εφαρμογή **αρνείται να ξεκινήσει χωρίς `DATABASE_URL`**. Άρα δεν υπάρχει πιθανότητα production deployment να πέσει κατά λάθος στο legacy JSON backend.

```bash
cp .env.example .env
# συμπλήρωσε secrets
npm ci
npm run build
npm start
```

ή Docker:

```bash
docker compose up -d --build
```

## Migration από v4.1 local JSON

```bash
DATABASE_URL=postgres://... npm run migrate:legacy
```

Προαιρετικά:

```bash
LEGACY_JSON=/path/to/db.json DATABASE_URL=postgres://... npm run migrate:legacy
```

Πριν migration κράτησε backup της παλιάς βάσης.

## Scale path

Η v5.0 αφαιρεί τα βασικά bottlenecks της v4.1 για 1.000+ επαγγελματίες. Για επόμενο επίπεδο (δεκάδες χιλιάδες ενεργούς χρήστες) προτείνεται:

1. Redis για rate limits/cache/pub-sub υψηλής συχνότητας.
2. S3-compatible object storage αντί local volume.
3. PostGIS για μεγάλης κλίμακας geospatial search.
4. Background jobs/queue για emails, billing retries και analytics rollups.
5. Πλήρες component split του frontend και automated E2E suite.
6. Independent penetration test + DPIA πριν από πραγματικά δεδομένα υγείας.


## v5.1 deployment topology

`nginx → app1/app2/app3 → PostgreSQL + Redis`. Οι sessions παραμένουν PostgreSQL-backed και τα live events χρησιμοποιούν PostgreSQL LISTEN/NOTIFY, άρα δεν απαιτούνται sticky sessions. Το shared upload volume είναι κατάλληλο για multi-container scale σε έναν host· object storage παραμένει επόμενο βήμα για multi-host scale.
