# MELEO v6.0 — Production Launch Runbook

## 1. Freeze

Τρέξε όλα τα v5.7 evidence checks στο production-like περιβάλλον και βεβαιώσου ότι το `npm run release:go-no-go` επιστρέφει `GO`.

## 2. Δημιουργία immutable manifest

```bash
npm run release:manifest
```

Δημιουργείται `reports/release-manifest-v6.0.0.json` με SHA-256 για τα κρίσιμα αρχεία του release.

## 3. Human approval

Μόνο μετά τον τελικό τεχνικό/νομικό έλεγχο:

```env
NODE_ENV=production
LAUNCH_APPROVED=YES
RELEASE_TAG=v6.0.0
```

## 4. Launch guard

```bash
npm run release:launch-guard
```

Απαιτεί:
- v5.7 `GO` evidence εντός του configured freshness window,
- `LAUNCH_APPROVED=YES`,
- σωστό release tag,
- αμετάβλητο release manifest.

## 5. Production deployment

```bash
docker compose build --pull
docker compose up -d
docker compose ps
```

Έλεγξε `/api/health`, `/api/ready`, nginx/TLS, worker και metrics.

## 6. Smoke after deploy

Τρέξε critical E2E και ένα μικρό load gate. Επιβεβαίωσε Stripe webhook delivery, email delivery και admin TOTP.

## 7. Rollback trigger

Rollback αν υπάρχει sustained 5xx/error spike, failed readiness, payment/webhook regression, data-integrity issue ή authentication failure. Μην κάνεις schema destructive rollback. Επανέφερε την προηγούμενη εφαρμογή και κράτησε τη βάση μέχρι να επιβεβαιωθεί η ασφαλής ενέργεια.
