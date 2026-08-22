# MELEO v6.0 — Render Staging Guide

Αυτό το package προορίζεται αποκλειστικά για προσωρινό testing. Δεν αντικαθιστά το production deployment.

## Τι δημιουργεί το Render Blueprint
- 1 Free Web Service: React/Vite frontend + MELEO relational API
- 1 Free PostgreSQL database (λήγει μετά από 30 ημέρες)
- 1 Free Render Key Value / Redis-compatible instance
- Background worker μέσα στο ίδιο Web Service, επειδή τα standalone background workers δεν προσφέρονται στο Free plan
- Frankfurt region για web/database/Key Value

## Demo λογαριασμοί
- Admin: `admin@meleo.gr` / `admin123`
- Ιδιώτης: `patient@meleo.gr` / `demo123`
- Επαγγελματίας: `maria@meleo.gr` / `demo123`
- Επαγγελματίας 2: `nikos@meleo.gr` / `demo123`

## Stripe
Για UI/flow testing δεν απαιτείται Stripe: `DEMO_CHECKOUT=1`.
Αν θέλεις Stripe TEST mode, συμπλήρωσε στο Render Dashboard μόνο test credentials (`sk_test_...`, test webhook secret και test Price IDs). Μην χρησιμοποιήσεις live keys στο staging.

## Verification uploads
Στο δωρεάν staging χρησιμοποιείται local encrypted storage. Το filesystem του Free Web Service είναι ephemeral, επομένως test uploads μπορεί να χαθούν σε restart/redeploy. Χρησιμοποίησε μόνο ψεύτικα/test documents.

## Deploy
1. Ανέβασε τον φάκελο σε ιδιωτικό GitHub repository.
2. Render Dashboard → New → Blueprint.
3. Σύνδεσε το repository. Το Render θα διαβάσει το `render.yaml`.
4. Δημιούργησε τα resources.
5. Αν σε ρωτήσει για τα Stripe env vars, άφησέ τα κενά για demo checkout ή βάλε αποκλειστικά TEST values.
6. Περίμενε μέχρι Web Service, Postgres και Key Value να γίνουν διαθέσιμα.
7. Άνοιξε το `https://<service>.onrender.com` URL από κινητό.

## Έλεγχοι
- `/api/health`
- `/api/ready`
- Login με όλους τους demo ρόλους
- Search / professional profiles
- Booking/request flows
- Professional dashboard
- Admin dashboard
- Mobile menu/responsive UI

## Free-tier περιορισμοί
- Το Free Postgres λήγει 30 ημέρες μετά τη δημιουργία.
- Free Web Services spin down μετά από αδράνεια και το πρώτο request μπορεί να αργήσει.
- Free Web Service filesystem είναι ephemeral.
- Free Key Value είναι in-memory και μπορεί να χάσει cache/rate-limit state σε restart.
- Δεν χρησιμοποιείται για production ή πραγματικά προσωπικά/ιατρικά δεδομένα.
