
## v5.3 object storage gate

- [ ] Private S3-compatible bucket created (public access disabled).
- [ ] Bucket-scoped access credentials configured.
- [ ] `STORAGE_DRIVER=s3` and all `S3_*` variables configured.
- [ ] Stable `SENSITIVE_DATA_KEY` backed up securely.
- [ ] `/api/ready` reports `objectStorage: true`.
- [ ] Upload and admin download tested with a real PDF/JPG.

# MELEO v5.1 — Launch Checklist

## Infrastructure
- [ ] DNS `meleo.gr` / `www.meleo.gr` δείχνει στον production server.
- [ ] `POSTGRES_PASSWORD` ισχυρό και μοναδικό.
- [ ] `REDIS_PASSWORD` ισχυρό, URL-safe και μοναδικό.
- [ ] `docker compose ps` δείχνει healthy: db, redis, app1, app2, app3, nginx.
- [ ] Επαναλαμβανόμενο `/api/health` επιστρέφει και τα 3 instance IDs.
- [ ] `/api/ready` επιστρέφει `database:true` και `redis:true`.
- [ ] `TRUST_PROXY=1`.
- [ ] TLS certificate ενεργό και HTTP→HTTPS redirect.
- [ ] Certbot renewal δοκιμασμένο.

## Security / secrets
- [ ] Stripe LIVE secret key.
- [ ] Stripe webhook secret από production endpoint.
- [ ] `ADMIN_PASSWORD` >= 12 χαρακτήρες.
- [ ] `ADMIN_TOTP_SECRET` production secret.
- [ ] `SENSITIVE_DATA_KEY` >= 32 χαρακτήρες, αποθηκευμένο εκτός git.
- [ ] `.env` δεν βρίσκεται στο repository / backup που μοιράζεται δημόσια.
- [ ] Admin login + TOTP δοκιμασμένο.

## Billing
- [ ] BASIC live Price ID = 9,99€/μήνα.
- [ ] PREMIUM live Price ID = 14,99€/μήνα.
- [ ] Πραγματική δοκιμαστική live χρέωση μικρής κλίμακας ολοκληρώθηκε.
- [ ] `checkout.session.completed` webhook = 200.
- [ ] `invoice.paid` / `invoice.payment_failed` ελεγμένα.
- [ ] Billing Portal: αλλαγή κάρτας, cancellation, renewal ελεγμένα.

## Data / backups
- [ ] Αυτόματο καθημερινό PostgreSQL backup.
- [ ] Off-server αντίγραφο backup.
- [ ] Πραγματικό restore σε καθαρή PostgreSQL δοκιμασμένο.
- [ ] Backup του `meleo-uploads` volume.
- [ ] Διαδικασία recovery καταγεγραμμένη.

## GDPR / legal
- [ ] Δεν υπάρχουν `[ΠΡΟΣ ΣΥΜΠΛΗΡΩΣΗ]` στα production legal texts.
- [ ] Όροι Χρήσης ολοκληρωμένοι και ελεγμένοι.
- [ ] Privacy Policy ολοκληρωμένη και ελεγμένη.
- [ ] DPIA ολοκληρωμένη όπου απαιτείται.
- [ ] Συμβάσεις/DPA άρθρου 28 με processors/hosting.
- [ ] Retention/deletion policy για verification documents και λογαριασμούς.

## Functional smoke test
- [ ] Patient registration/login/logout/reset password.
- [ ] Professional registration/onboarding/subscription.
- [ ] Verification upload + admin approve/reject.
- [ ] Public professional search.
- [ ] Booking + clarification/messages + final price flow.
- [ ] Notifications/live SSE λειτουργούν με πολλαπλά app nodes.
- [ ] Review flow.
- [ ] Admin analytics/reports.

## Scale baseline
- [ ] `npm run concurrency` επιτυχές.
- [ ] `npm run loadtest` σε production-like staging.
- [ ] Καταγράφηκαν p50/p95/p99 latency, requests/sec και error rate.
- [ ] PostgreSQL connection usage παρακολουθήθηκε στο load test.
- [ ] Redis memory/latency παρακολουθήθηκαν στο load test.

## v5.2 — Background jobs & observability
- [ ] `OBSERVABILITY_TOKEN` έχει οριστεί με ισχυρή τυχαία τιμή.
- [ ] Το `worker` service εμφανίζεται healthy/running στο deployment.
- [ ] Δοκιμαστικό transactional email καταλήγει σε `background_jobs.status=completed`.
- [ ] `/api/metrics` επιστρέφει 404 χωρίς token και metrics με έγκυρο Bearer token.
- [ ] Δεν υπάρχουν αυξανόμενα `background_jobs_failed`.
- [ ] Έχουν ρυθμιστεί alerts για HTTP 5xx, queue depth και failed jobs.
