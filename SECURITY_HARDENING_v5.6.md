# MELEO v5.6 — Security Hardening

Η v5.6 προσθέτει admin-specific distributed throttling, per-account login throttling, προαιρετικό `ADMIN_IP_ALLOWLIST`, 8ωρες admin sessions, User-Agent binding για admin sessions, security audit events, ενεργές sessions/revoke-other-sessions endpoints, secret scanning, dependency audit και blocking CI release gates.

Production defaults:
```env
ADMIN_IP_ALLOWLIST=
ADMIN_SESSION_TTL_HOURS=8
ADMIN_BIND_USER_AGENT=1
```

Commands:
```bash
npm run security:secrets
npm run security:audit
npm run security:check
npm run v56-check
npm run ci:gate
```

Independent penetration testing παραμένει εξωτερικό pre-launch requirement και δεν αντικαθίσταται από automated scanning.
