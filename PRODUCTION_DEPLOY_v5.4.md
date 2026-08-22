# MELEO v5.4 — Frontend Deployment Notes

Η v5.4 δεν αλλάζει το Docker topology των v5.1–v5.3. Χρησιμοποίησε το ίδιο PostgreSQL + Redis + app replicas + worker + nginx + S3-compatible storage configuration.

Πριν το deploy:

```bash
npm ci
npm run frontend-architecture-check
npm run typecheck
npm run build
```

Μετά το build, επιβεβαίωσε ότι στο `dist/assets` υπάρχουν χωριστά chunks για admin/professional/support/account και όχι ένα μοναδικό application JS bundle.

Μετά το deploy κάνε smoke test σε:
- `/` και αναζήτηση χωρίς login
- patient login/dashboard
- professional login/dashboard/onboarding
- admin login/control center
- notifications/help/account/legal routes
