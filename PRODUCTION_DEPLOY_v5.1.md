# MELEO v5.1 — Production deployment

Η v5.1 κρατά ακριβώς το relational PostgreSQL data model της v5.0 και αλλάζει το deployment/runtime layer: 3 Node instances, nginx load balancing και Redis-backed rate limiting/cache.

## 1. Server prerequisites

- Ubuntu/Debian server με Docker Engine + Docker Compose plugin.
- DNS `meleo.gr` και `www.meleo.gr` προς τη δημόσια IP του server.
- Θύρες 80/443 ανοιχτές.
- Certbot εγκατεστημένο στο host για το πρώτο Let's Encrypt certificate.

## 2. Environment

```bash
cp .env.example .env
nano .env
```

Υποχρεωτικά production values: `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `APP_URL=https://meleo.gr`, Stripe live keys/webhook, ισχυρό `ADMIN_PASSWORD`, `ADMIN_TOTP_SECRET`, `SENSITIVE_DATA_KEY` και τα νομικά στοιχεία.

Για `REDIS_PASSWORD` προτίμησε 32+ τυχαίους URL-safe αλφαριθμητικούς χαρακτήρες, επειδή χρησιμοποιείται και στο Redis connection URL.

## 3. First TLS certificate

Το κανονικό nginx config δεν ξεκινά χωρίς certificate. Πριν σηκώσεις ολόκληρο το stack:

```bash
docker compose up -d db redis app1 app2 app3
sudo certbot certonly --standalone -d meleo.gr -d www.meleo.gr
```

Μετά:

```bash
docker compose up -d --build
```

Το `/etc/letsencrypt` του host γίνεται read-only mount στο nginx container.

## 4. Verify all three app instances

```bash
docker compose ps
curl -s https://meleo.gr/api/health
curl -s https://meleo.gr/api/ready
```

Το `/api/health` επιστρέφει πεδίο `instance`. Με επαναλαμβανόμενα requests θα βλέπεις `app1`, `app2`, `app3` λόγω `least_conn` load balancing.

```bash
for i in $(seq 1 12); do curl -s https://meleo.gr/api/health | grep -o '"instance":"[^"]*"'; done
```

## 5. Redis behavior

- Rate limiting: Redis atomic `INCR + PEXPIRE` μέσω Lua.
- Geocode cache: Redis hot cache, PostgreSQL παραμένει durable fallback.
- Αν υπάρξει στιγμιαίο Redis error, ο limiter γυρίζει στο PostgreSQL `rate_limits` table ώστε η εφαρμογή να συνεχίσει.
- Με `REDIS_REQUIRED=1`, το readiness endpoint γίνεται `503` όσο το Redis δεν είναι διαθέσιμο, ώστε το node να μη θεωρείται production-ready.

## 6. PostgreSQL connections

Default: `DATABASE_POOL_MAX=8` ανά instance. Με 3 instances σημαίνει έως περίπου 24 application pool connections, συν maintenance/listener connections. Μην αυξήσεις αυθαίρετα το pool χωρίς να ελέγξεις `max_connections` και πραγματική χρήση.

## 7. Zero/minimal downtime application update

```bash
docker compose build app1 app2 app3
docker compose up -d --no-deps app1
curl -fsS https://meleo.gr/api/ready
docker compose up -d --no-deps app2
curl -fsS https://meleo.gr/api/ready
docker compose up -d --no-deps app3
```

Το nginx κάνει retry σε άλλο upstream για connect/502/503/504 failures. Οι sessions είναι PostgreSQL-backed και τα live events διανέμονται με PostgreSQL LISTEN/NOTIFY, επομένως δεν απαιτείται sticky session.

## 8. Backups

Database example:

```bash
mkdir -p /opt/meleo/backups
docker compose exec -T db pg_dump -U meleo -d meleo -Fc > /opt/meleo/backups/meleo-$(date +%F-%H%M).dump
```

Verification documents παραμένουν σε `meleo-uploads` named volume στη v5.1. Πρέπει να γίνεται ξεχωριστό encrypted/off-server backup. Μετάβαση σε S3-compatible object storage είναι το επόμενο infrastructure milestone.

## 9. Certificate renewal

Το Certbot renewal γίνεται στο host. Μετά την ανανέωση:

```bash
sudo certbot renew
cd /path/to/meleo
docker compose exec nginx nginx -s reload
```

## 10. Rollback

Η v5.1 δεν αλλάζει schema, οπότε rollback στον v5.0 application image είναι εφικτό χωρίς database migration rollback. Πριν από κάθε production deploy διατήρησε database backup και το προηγούμενο release ZIP/image tag.
