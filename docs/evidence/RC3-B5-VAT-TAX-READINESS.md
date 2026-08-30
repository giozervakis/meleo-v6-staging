# RC3-B5 — VAT / Tax Readiness

Status: **TECHNICAL GUARD IMPLEMENTED — TAX/ACCOUNTING SIGN-OFF REQUIRED BEFORE LIVE PRODUCTION**

Release: `meleo-production-architecture@7.0.0-rc.2`

## Scope

RC3-B5 prevents MELEO from silently entering live production subscription billing with tax handling disabled or undefined.

This is a technical readiness control. It is not tax, accounting, or legal advice and does not determine the VAT treatment that applies to the final MELEO legal entity.

## Existing Stripe Checkout capabilities

The subscription Checkout path already supports:

- required billing-address collection;
- Stripe Tax ID collection through `STRIPE_COLLECT_TAX_ID`;
- Stripe Automatic Tax through `STRIPE_AUTOMATIC_TAX`;
- persistence of customer name and address from Checkout;
- Stripe recurring subscription invoices/payments;
- MELEO billing-history persistence from Stripe invoice/payment lifecycle events.

## RC3-B5 fail-closed production guard

Production startup now requires all of the following:

- `STRIPE_COLLECT_TAX_ID=1`
- `STRIPE_AUTOMATIC_TAX=1`
- `STRIPE_TAX_CODE=<accountant-approved Stripe Tax Code>`

If any of these are missing, production readiness fails instead of allowing live subscription billing with an incomplete tax configuration.

A dedicated `tax-readiness-check` is included in the project CI gate so that the production guard cannot be silently removed without failing the release checks.

## Required external sign-off before production

Before live Stripe billing is enabled, MELEO must document the final business configuration with its accountant/tax adviser, including as applicable:

1. Final legal entity and billing identity.
2. VAT number and registered business address.
3. VAT treatment of MELEO subscription services.
4. Stripe Tax registrations/jurisdictions that must be enabled.
5. The Stripe Tax Code appropriate for the MELEO subscription service.
6. Required invoice legal fields and numbering.
7. B2B/B2C Tax ID and reverse-charge handling.
8. Any Greek electronic-invoicing / myDATA obligations and the mechanism used to satisfy them.

## Boundary

Enabling Stripe Automatic Tax does not by itself prove Greek bookkeeping, invoicing, VAT-return, or myDATA compliance.

Those obligations depend on the final legal entity and accountant-approved operating model and must be handled separately before public live billing.

## Verdict

**RC3-B5 technical tax-readiness guard: IMPLEMENTED / PASS**

**Production tax/accounting sign-off: REQUIRED**

The application is fail-closed against production billing when Automatic Tax, Tax ID collection, or the approved Stripe Tax Code is absent.