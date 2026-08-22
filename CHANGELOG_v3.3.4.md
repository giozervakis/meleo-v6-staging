# MELEO v3.3.4 — Integrity & Privacy Hardening

- Fixed subscription grace-period checkout call (`subscriptionAllowsVisibility(status, professional)`).
- Added automatic retry/finalization for `deletionPending` accounts and Admin visibility.
- Added server-side analytics deduplication with hashed visitor fingerprint + dedicated analytics rate limit.
- Removed phone/email from search-list responses; public profile contact details now respect professional opt-in controls.
- Added professional controls for public phone/email and platform-first contact preference.
- Added TOTP anti-replay by tracking the last accepted 30-second time step for Admin.
- Verification uploads now validate real file signatures (magic bytes) and Admin downloads are forced as attachments.
- Desktop account dropdown supports Escape (retained and verified).
- Updated runtime/version labels to 3.3.4.

## Known architecture items before scale-out
- Rate limits are still process-local; use Redis/shared limiter before horizontal multi-instance deployment.
- PostgreSQL storage still uses the `meleo_docs` JSONB abstraction. A normalized relational schema is recommended before large-scale analytics/reporting workloads.

- Public profile endpoint has a dedicated anti-scraping rate limit and search results no longer expose phone/email.
- Analytics uses a server-issued httpOnly visitor cookie plus network fingerprint to resist trivial counter inflation.
