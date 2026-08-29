# RC3-B4 — Stripe Billing Portal Validation Evidence

Status: **FULLY CLOSED**

Release: `meleo-production-architecture@7.0.0-rc.2`

## Scope

RC3-B4 validates that an authenticated MELEO professional with Stripe billing can enter the Stripe-hosted Billing Portal from the MELEO subscription experience and return safely to MELEO.

This item is distinct from RC3-B2 subscription lifecycle testing and RC3-B3 Stripe test/live environment isolation.

## Implementation evidence

The professional subscription API reports Billing Portal availability only when Stripe is available, the portal feature is enabled, and the professional has a Stripe subscription.

The Billing Portal endpoint:

- is `POST /api/professional/subscription/portal`;
- requires authentication;
- requires the `professional` role;
- obtains the MELEO user from the authenticated email;
- resolves or creates the matching Stripe customer through `ensureStripeCustomer`;
- creates a Stripe Billing Portal session server-side;
- uses the Stripe-hosted portal URL returned by Stripe;
- sets the return URL to `${config.appUrl}/?billing=return`;
- requests Greek Stripe Portal locale (`el`);
- returns only the generated portal URL to the authenticated client.

The Stripe secret key remains server-side and is not returned to the browser.

## Runtime validation

The Billing Portal was tested manually against the deployed MELEO Render staging environment using the Stripe Sandbox/Test Mode customer created during RC3-B2 testing.

Observed result:

- MELEO subscription/billing screen exposed the Billing Portal action;
- the action opened the real Stripe-hosted Billing Portal successfully;
- the correct Stripe test customer context was accessible;
- subscription/payment/billing information was accessible in the hosted portal;
- the portal interaction completed without application error;
- the user explicitly confirmed the deployed portal flow worked correctly.

Runtime result: **PASS**

## Related evidence

RC3-B3 independently proved that the deployed staging environment was connected to Stripe Test Mode and that the expected MELEO webhook and BASIC/PREMIUM prices existed in that same test environment.

RC3-B2 separately covers the broader hosted Checkout and subscription lifecycle journey. Its failed-payment/recovery scenario remains outside this B4 closure.

## Security boundary

No Stripe secret key, webhook signing secret, card number, or CVC is stored in this evidence.

Billing Portal session creation is server-side and protected by MELEO authentication and professional-role authorization.

## Verdict

**RC3-B4 PASS / FULLY CLOSED**

The deployed staging application successfully launches the Stripe-hosted Billing Portal for an authenticated professional in the MELEO Stripe Test environment, with the expected return path to MELEO.