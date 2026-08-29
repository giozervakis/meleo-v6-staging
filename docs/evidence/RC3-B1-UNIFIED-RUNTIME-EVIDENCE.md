# MELEO RC3-B1 Unified Runtime Evidence

**Status:** FULLY CLOSED  
**Release:** 7.0.0-rc.2  
**Validated commit:** `44525be0afb83c36cf89e7db70c66088ca298680`  
**Target:** `https://meleo-v6-staging.onrender.com`  
**Closure evidence generated:** `2026-08-29T19:26:48Z`

## Scope

RC3-B1 required fresh post-RC3 runtime proof for the database, booking concurrency, authorization boundaries, GDPR export/deletion, Stripe webhook idempotency and ordering, authenticated booking-list performance, and bounded public staging HTTP load.

This document records runtime evidence only. It does not claim production capacity, real-money Stripe charging, production email delivery, or production PostgreSQL certificate-chain verification.

## Unified staging harness

The unified harness executed against the RC3 staging deployment and Render PostgreSQL.

- Migration runner self-test: **PASS**
- Concurrent double-booking on live PostgreSQL: **PASS**
- Booking-list N+1 invariant: **PASS**
- GDPR lifecycle invariant: **PASS**
- Authorization/Stripe invariant: **PASS**
- Database TLS invariant: **PASS**

### Live PostgreSQL concurrency

A real concurrent race targeted one professional and one active slot.

- Successful booking inserts: **1**
- Rejected booking inserts: **1**
- PostgreSQL rejection code: **23505**
- Unique constraint: `bookings_professional_active_slot_unique_idx`
- Active rows persisted for the slot: **1**

Result: **PASS — two concurrent requests cannot persist two active bookings for the same professional slot.**

### Bounded public HTTP staging load

| Phase | Result | p95 | p99 |
| --- | --- | ---: | ---: |
| health-c1 | PASS | 422.1 ms | 422.1 ms |
| health-c4 | PASS | 241.9 ms | 241.9 ms |
| health-c8 | PASS | 154.6 ms | 154.6 ms |
| config-c4 | PASS | 93.1 ms | 93.1 ms |
| plans-c4 | PASS | 91.7 ms | 91.7 ms |

This is deliberately capped staging evidence. It is **not** a production capacity benchmark.

## Credentialed live runtime suite

The credentialed suite executed disposable staging identities and fixtures, verified results through both HTTP and PostgreSQL, then cleaned up the fixtures.

### Authorization matrix

| Check | Expected | Observed |
| --- | ---: | ---: |
| Patient own booking list | 200 | 200 |
| Assigned professional booking list | 200 | 200 |
| Other patient mutation | 403 | 403 |
| Unrelated professional mutation | 403 | 403 |
| Patient access to professional billing | 403 | 403 |
| Patient provider-state mutation | 403 | 403 |
| Assigned professional mutation | 200 | 200 |

Result: **PASS**

### Authenticated booking-list runtime

- Requests: **24**
- Concurrency: **4**
- Failures: **0**
- HTTP 5xx: **0**
- p95: **383 ms**
- p99: **488.6 ms**

Result: **PASS**

### GDPR export completeness

- Exported bookings: **106**
- Reported total bookings: **106**
- Complete: **True**

The export crossed the 100-row repository page size and returned the complete dataset.

Result: **PASS**

### Stripe signed webhook runtime

- Invalid signature rejected: **HTTP 400**
- New signed event: **HTTP 200**
- Duplicate signed event: **HTTP 200**
- Stale signed event: **HTTP 200**
- Webhook DB evidence rows: **2**
- Plan after newer event: **premium**
- Plan after stale event: **premium**

The stale event did not roll the professional subscription backward.

Result: **PASS**

### GDPR deletion runtime

Patient:

- Delete: **HTTP 200**
- Old credentials after deletion: **HTTP 401**
- Remaining sessions: **0**
- Residual booking PII rows: **0**

Professional:

- Delete: **HTTP 200**
- Old credentials after deletion: **HTTP 401**

Database verification also confirmed tombstone identities, destroyed reusable password hashes, professional profile scrubbing, cancelled visibility state, and removed sessions.

Result: **PASS**

## PostgreSQL transport note

The external Render PostgreSQL connection reported SSL active during runtime validation.

The local staging test runner used TLS with `rejectUnauthorized:false` solely for the Render external test connection. Therefore this evidence proves **encrypted staging transport**, but does **not** claim that the RC3-A3 production CA/certificate-verification path was exercised end-to-end in this run.

## Stripe scope note

The Stripe evidence used the configured **staging webhook signing secret** and synthetic correctly signed webhook events. No real card and no real money were used.

Full browser/user Stripe Checkout lifecycle remains RC3-B2.

## Cleanup and repository integrity

- Disposable runtime identities/fixtures: cleaned up by the credentialed suite
- Runtime evidence secrets: not written to repository
- Repository after runtime suite: **clean**
- Application code changed by RC3-B1 closure: **none**
- Migration files changed by RC3-B1 closure: **none**

## Final RC3-B1 verdict

**RC3-B1: FULLY CLOSED**

All required RC3-B1 runtime gates completed successfully on staging:

1. live PostgreSQL concurrency,
2. authorization boundaries,
3. GDPR export completeness,
4. GDPR patient/professional deletion,
5. Stripe signed webhook signature/idempotency/stale-ordering,
6. authenticated booking-list runtime performance,
7. bounded public staging load,
8. cleanup and repository-integrity verification.

The next release work item is **RC3-B2 — full Stripe Sandbox browser/user E2E**.
