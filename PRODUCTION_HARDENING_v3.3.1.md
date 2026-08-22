# MELEO v3.3.1 — Production Hardening

Η έκδοση 3.3.1 διορθώνει τα κρίσιμα σημεία του audit της 3.3.0 και προσθέτει πλήρες responsive/mobile pass.

## Κρίσιμες διορθώσεις

- Stripe webhook idempotency με `processing/completed/failed`, retry-safe συμπεριφορά και προστασία από ταυτόχρονη διπλή επεξεργασία.
- Ασφαλής διαγραφή λογαριασμού: η διαγραφή **δεν ολοκληρώνεται** αν δεν επιβεβαιωθεί πρώτα η ακύρωση ενεργής Stripe συνδρομής.
- Session authentication με `httpOnly`, `Secure` (production), `SameSite=Lax` cookie. Το frontend δεν αποθηκεύει πλέον auth token σε `localStorage`.
- Same-origin protection για state-changing API calls.
- Admin TOTP 2FA μέσω `ADMIN_TOTP_SECRET` (υποχρεωτικό σε production).
- Application-level AES-256-GCM encryption για ευαίσθητες σημειώσεις booking.
- Κρυπτογραφημένη αποθήκευση verification files (PDF/JPG/PNG/WEBP, έως 5MB) και ελεγχόμενη προβολή μόνο από Admin.
- Verification request μπορεί να συσχετιστεί με πραγματικά δικαιολογητικά. Σε production απαιτείται τουλάχιστον ένα document.
- Smart Request: αφαιρέθηκε το επικίνδυνο fallback σε Νοσηλευτική. Αν δεν υπάρχει ασφαλές match, ζητείται χειροκίνητη επιλογή.
- Smart Request emergency interception για ενδεικτικές λέξεις υψηλού κινδύνου και άμεση επιλογή κλήσης 112.
- Ρητή συγκατάθεση χρήστη πριν κοινοποιηθούν email/τηλέφωνο στον επαγγελματία.
- Transactional email HTML escaping για user-controlled values.
- Subscription grace period με `SUBSCRIPTION_GRACE_DAYS` και `pastDueSince`.
- Admin οικονομικά: MRR υπολογίζεται μόνο από `active` subscriptions. Προστέθηκαν collected revenue, failed revenue/payments και outstanding amount.
- ZIP χωρίς `node_modules`. Για καθαρή εγκατάσταση χρησιμοποιείται `npm ci`.
- Versioning διορθωμένο σε 3.3.1.

## Mobile / responsive

- Πλήρες hamburger / slide-in mobile menu.
- Responsive hero, search 3 επιπέδων, Smart Request, MELEO Now, profiles και booking flow.
- Mobile Professional Dashboard με horizontal navigation αντί desktop sidebar.
- Mobile Admin Control Center με scrollable tabs και ασφαλές horizontal table scrolling.
- Responsive onboarding / checkout / verification / subscription screens.
- Responsive auth/register, pricing, footer, forms, dialogs, cards και request conversation flow.
- 16px form controls σε mobile για αποφυγή iOS auto-zoom.
- Mobile touch targets και reduced horizontal overflow.

## Production environment variables που προστέθηκαν

- `ADMIN_TOTP_SECRET`
- `SENSITIVE_DATA_KEY`
- `VERIFICATION_STORAGE_DIR`
- `SUBSCRIPTION_GRACE_DAYS`

## Σημαντικό για deployment

Η εφαρμογή εξακολουθεί να χρειάζεται πραγματικά credentials/υποδομή για PostgreSQL, Stripe, Resend, DNS/HTTPS και production backups. Το `VERIFICATION_STORAGE_DIR` πρέπει να βρίσκεται σε κρυπτογραφημένο persistent volume με πρόσβαση μόνο στο API process. Σε multi-instance deployment προτείνεται migration των verification files σε S3-compatible private object storage και distributed rate limiting (Redis).
