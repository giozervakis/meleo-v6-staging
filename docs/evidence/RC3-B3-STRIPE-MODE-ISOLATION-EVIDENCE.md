# RC3-B3 — Stripe Test/Live Mode Isolation Runtime Evidence

Status: **FULLY CLOSED**

Release: `meleo-production-architecture@7.0.0-rc.2`

## Static guard

Static Stripe environment isolation was implemented by commit:

`b0dcd0215db189d27fd39a731709c1badef3acf1`
`fix(billing): isolate Stripe test and live modes`

The guard separates Stripe environments as follows:

- production requires a Stripe live secret key (`sk_live_`);
- staging Stripe mode requires a Stripe test secret key (`sk_test_`);
- webhook secret and BASIC/PREMIUM Price IDs are required;
- production/staging configuration validation rejects the wrong key mode;
- Stripe readiness validates configured prices and webhook against the Stripe account reachable with the configured key.

## Runtime proof

A temporary staging-only startup probe was deployed in:

`d25f2d01189dbd02a98768aa9d363b1be42a7f14`
`test(release): add temporary Stripe staging probe`

Observed Render staging log:

- checkedAt: `2026-08-29T23:34:16.096Z`
- environment: `staging`
- expected Stripe mode: `test`
- actual Stripe mode: `test`
- webhook secret configured: `true`
- Stripe account reachable: `true`
- BASIC Price reachable: `true`
- BASIC active: `true`
- BASIC currency: `eur`
- BASIC amount: `999` cents
- BASIC recurrence: `month`
- PREMIUM Price reachable: `true`
- PREMIUM active: `true`
- PREMIUM currency: `eur`
- PREMIUM amount: `1499` cents
- PREMIUM recurrence: `month`
- expected webhook:
  `https://meleo-v6-staging.onrender.com/api/webhooks/stripe`
- webhook found in the same Stripe test environment: `true`
- failures: none
- runtime probe result: `passed=true`

Exact non-secret runtime payload:

```json
{"marker":"RC3-B3-RUNTIME-PROBE","version":"7.0.0-rc.2","checkedAt":"2026-08-29T23:34:16.096Z","passed":true,"checks":{"environment":"staging","expectedMode":"test","mode":"test","webhookSecretConfigured":true,"accountReachable":true,"basic":{"reachable":true,"active":true,"currency":"eur","unitAmount":999,"recurringInterval":"month"},"premium":{"reachable":true,"active":true,"currency":"eur","unitAmount":1499,"recurringInterval":"month"},"webhook":{"wanted":"https://meleo-v6-staging.onrender.com/api/webhooks/stripe","found":true}},"failures":[]}
```

## Security notes

The evidence contains no Stripe secret key and no webhook signing secret.

Stripe Price IDs are intentionally omitted from this permanent evidence because the proof only needs to establish that the configured IDs were reachable and matched the expected commercial configuration under the staging test key.

The temporary startup probe was removed immediately after collecting the evidence. It is not part of the permanent application runtime.

## Verdict

**RC3-B3 PASS / FULLY CLOSED**

The deployed staging environment is proven to use Stripe Test Mode, with the expected BASIC and PREMIUM monthly EUR prices and the expected webhook registered in the reachable Stripe test account.

This evidence does not claim production live-mode execution. Production is protected statically by the live-key guard and must receive live Stripe configuration only at production provisioning time.