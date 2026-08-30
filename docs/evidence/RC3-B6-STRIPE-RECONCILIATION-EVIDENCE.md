# RC3-B6 — Stripe ↔ MELEO Reconciliation Evidence

Status: **FULLY CLOSED**

Release: `meleo-production-architecture@7.0.0-rc.2`

## Scope

RC3-B6 verifies that MELEO has a periodic server-side reconciliation path that compares known MELEO Stripe subscriptions against Stripe and repairs local subscription state when drift is detected.

This is a recovery/consistency control in addition to normal Stripe webhook processing.

## Implementation evidence

`server/stripe-reconciliation.js` provides the reconciliation domain logic.

For known Stripe subscription IDs it:

- retrieves the authoritative subscription from Stripe;
- resolves the corresponding MELEO professional;
- derives the BASIC/PREMIUM plan;
- maps Stripe status to MELEO subscription status;
- compares plan, price, status, subscription ID, billing period end, cancellation state, featured state, and billing mode;
- updates the professional when local state differs;
- upserts the relational `subscriptions` ledger;
- counts matched, corrected, unchanged, missing-at-Stripe, and failed records;
- emits structured reconciliation logs;
- treats total Stripe-call failure as a failed reconciliation instead of a false success.

The scheduler prevents duplicate pending/processing `stripe_reconcile` jobs.

`server/worker.js`:

- schedules reconciliation shortly after worker startup;
- executes `stripe_reconcile` jobs;
- logs the reconciliation summary;
- schedules the next periodic run;
- uses the existing background-job retry/dead-letter behavior on failures.

## Runtime staging evidence

A deployed Render staging worker emitted the following successful reconciliation summary during RC3 validation:

- `scanned`: 2
- `matched`: 2
- `corrected`: 0
- `unchanged`: 2
- `missingAtStripe`: 0
- `failed`: 0

The same run emitted both:

- `stripe.reconcile.completed`
- `job.stripe_reconcile.completed`

Interpretation: the worker reached Stripe successfully, matched both known MELEO subscriptions to Stripe, found no drift requiring correction, and completed without reconciliation failures.

This evidence proves the normal no-drift runtime path. It does not claim that a deliberate production-state corruption was introduced merely to force a correction.

## Release regression guard

`stripe-reconciliation-check` statically verifies the presence of the reconciliation, scheduling, summary/error, duplicate-job prevention, and worker execution invariants.

The check is part of `ci:gate`.

## Security and operational boundary

Reconciliation uses the server-side Stripe key and does not expose Stripe credentials to the browser.

Webhook processing remains the primary event-driven synchronization path. Reconciliation is the periodic consistency/recovery layer for missed events or state drift.

## Verdict

**RC3-B6 PASS / FULLY CLOSED**

MELEO has a periodic Stripe-to-local reconciliation mechanism, worker scheduling/retry behavior, structured outcome reporting, regression coverage, and successful staging runtime evidence.