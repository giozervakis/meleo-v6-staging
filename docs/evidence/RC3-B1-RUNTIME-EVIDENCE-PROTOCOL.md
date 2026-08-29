# MELEO RC3-B1 - Unified Runtime Evidence Protocol

RC3-B1 creates one repeatable evidence path after the RC3 correctness changes and explicitly separates live runtime evidence from static/source invariants.

## Required environment

```text
NODE_ENV=staging
DATABASE_URL=<staging PostgreSQL URL>
MELEO_STAGING_URL=https://meleo-v6-staging.onrender.com
```

Never store database or Stripe secrets in committed evidence.

## Harness coverage

- migration ledger/lock/checksum self-test;
- real PostgreSQL concurrent double-booking race;
- booking-list bounded query-shape self-test;
- GDPR lifecycle source invariants;
- authorization + Stripe webhook source invariants;
- PostgreSQL TLS source invariants;
- bounded live HTTP phases for health/config/plans up to concurrency 8.

Generated reports go to `reports/runtime-evidence/`.

## Closure rule

A green harness returns `PARTIAL_PASS_AWAITING_CREDENTIALED_RUNTIME` by design. Full RC3-B1 closure additionally requires fresh credentialed staging evidence for the authorization matrix, GDPR export/deletion lifecycle, signed Stripe webhook duplicate/stale ordering, and authenticated booking-list HTTP behavior.

The bounded staging load is not a production capacity benchmark.