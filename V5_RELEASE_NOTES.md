# MELEO v5.0 — Release Notes

**Στόχος:** Production Architecture / Scalability refactor.

Η λειτουργικότητα της v4.1 παραμένει η product baseline. Η v5.0 αντικαθιστά το production storage/runtime foundation με relational PostgreSQL και multi-instance-safe patterns.

### Νέα production primitives

- 20+ relational tables με FK/indexes.
- Paginated APIs.
- Async password hashing.
- Distributed session/rate-limit storage.
- PostgreSQL LISTEN/NOTIFY for live communication.
- Persisted geocoding cache.
- Aggregated analytics.
- Encrypted, persistent verification uploads.
- Deep-link capable SPA routing.
- Sitemap / robots / profile SEO metadata / care landing pages.
- Legacy-to-v5 migration script.
- Architecture and load-test scripts.

### Validation commands

```bash
npm run architecture-check
npm run security-selftest
npm run build
npm run loadtest
```
