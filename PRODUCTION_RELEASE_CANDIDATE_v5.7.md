# MELEO v5.7 — Production Release Candidate

Η v5.7 δεν προσθέτει νέα product αρχιτεκτονική. Μετατρέπει την υπάρχουσα v5.6 σε release candidate με επαναλήψιμο και αποδείξιμο GO/NO-GO.

## 1. Production preflight

Με συμπληρωμένο `.env`:

```bash
npm run release:preflight
```

Ελέγχει production mode, HTTPS APP_URL, PostgreSQL/Redis/S3, Stripe, email, admin/TOTP, encryption key, νομικά στοιχεία και demo flags. Γράφει `reports/release-preflight.json`.

## 2. Database backup και restore drill

Απαιτούν PostgreSQL client tools (`pg_dump`, `pg_restore`).

```bash
npm run backup:db
```

Για restore drill χρησιμοποίησε ΑΠΟΚΛΕΙΣΤΙΚΑ disposable database:

```bash
export RESTORE_DATABASE_URL='postgres://.../meleo_restore_drill'
export ALLOW_RESTORE_DRILL=YES
npm run restore:drill
```

Το script αρνείται να τρέξει αν `RESTORE_DATABASE_URL === DATABASE_URL`.

## 3. Stripe readiness

```bash
npm run release:stripe
```

Ελέγχει API connectivity, BASIC/PREMIUM Price IDs, active prices και ότι υπάρχει webhook endpoint ακριβώς στο `${APP_URL}/api/webhooks/stripe`.

Στη συνέχεια απαιτείται χειροκίνητο end-to-end checkout σε Stripe test mode και, πριν το launch, μικρή πραγματική live συναλλαγή/επιστροφή σύμφωνα με τη λογιστική διαδικασία της επιχείρησης.

## 4. TLS / domain

```bash
npm run release:tls
```

Ελέγχει certificate trust, ημερομηνία λήξης (>=14 ημέρες), TLS protocol και `/api/health` μέσω του πραγματικού HTTPS domain.

## 5. Regression / load

```bash
npm run ci:gate
npm run e2e
npm run loadtest:stages
```

Για launch baseline κράτησε τα JSON reports μαζί με το release artifact.

## 6. Τελική απόφαση

```bash
npm run release:go-no-go
```

Απαιτεί φρέσκα PASS evidence (default <=72h) για preflight, TLS/domain, Stripe, backup, restore drill και critical E2E. Αν λείπει κάτι, αποτέλεσμα `NO-GO`.

## Εκτός κώδικα — υποχρεωτικά πριν το launch

- Νομικός έλεγχος Όρων Χρήσης / Privacy / cookies.
- DPIA όπου απαιτείται και συμβάσεις άρθρου 28 GDPR με processors/providers.
- Επιβεβαίωση φορολογικής/ΦΠΑ ρύθμισης Stripe με λογιστή.
- Offsite/encrypted backup retention και περιοδικό restore drill.
- Uptime/error alerts σε πραγματικό κανάλι ειδοποίησης.
- Independent penetration test πριν σημαντικό όγκο πραγματικών ευαίσθητων δεδομένων.

Η v5.7 είναι Release Candidate, όχι αυτόματη δήλωση ότι οι παραπάνω εξωτερικές υποχρεώσεις έχουν ολοκληρωθεί.
