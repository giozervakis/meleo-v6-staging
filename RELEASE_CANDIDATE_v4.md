# MELEO v4.0 Release Candidate

## Τι προστέθηκε

- Founder & Operations Admin Center με growth, conversion, quality, revenue και marketplace KPIs.
- Πλήρης διαχείριση μελών: suspend/reactivate, manual verify/unverify, featured/unfeatured με audit trail.
- Verification Operations με χειροκίνητη απόφαση και σημειώσεις admin.
- Insights: top professionals, review distribution, 7/30-day growth, repeat users.
- Audit Log UI για κρίσιμες administrative ενέργειες.
- Account status enforcement: suspended λογαριασμοί δεν μπορούν να χρησιμοποιούν ενεργές sessions.
- `/api/ready` readiness endpoint για production health checks.
- Version 4.0.0 και καθαρό Release Candidate packaging.

## Κανόνες Admin που πρέπει να διατηρηθούν

1. Το `MELEO Verified` δεν αγοράζεται και είναι ανεξάρτητο από BASIC/PREMIUM.
2. Η χειροκίνητη επαλήθευση από Admin καταγράφεται στο Audit Log.
3. Stripe-backed συνδρομές δεν πρέπει να αλλοιώνονται χειροκίνητα στη βάση· χρησιμοποιείται sync/Stripe portal.
4. Η αναστολή μέλους ακυρώνει τις ενεργές sessions του.
5. Το GMV δεν εμφανίζεται ως έσοδο MELEO. Τα πραγματικά έσοδα προέρχονται από subscriptions.

## Πριν το δημόσιο launch

- Production PostgreSQL με αυτοματοποιημένα encrypted backups και restore test.
- Live Stripe keys + live webhook endpoint + end-to-end renewal / failed-payment / cancellation tests.
- Production email provider και domain authentication (SPF/DKIM/DMARC).
- Admin TOTP 2FA secret σε secret manager.
- TLS/HTTPS, monitoring, error tracking, uptime alerts και centralized logs.
- DPIA/GDPR/legal review, Terms, Privacy, retention schedule και DPA με processors.
- External penetration test / OWASP ASVS review.
- Closed beta πριν το πανελλαδικό public launch.

## Readiness

- `GET /api/health`: runtime information.
- `GET /api/ready`: 200 όταν τα κρίσιμα production checks είναι έτοιμα, 503 όταν λείπει dependency/configuration.
