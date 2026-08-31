# RC3-D9B - Production Environment Isolation

## Status

Production/staging launch isolation hardening.

## Objective

Prevent a staging startup command or demo-capable runtime path from
being used accidentally as a production entry point.

## Existing production controls

The production launcher already requires:

- NODE_ENV=production
- MELEO_DEPLOYMENT_ENV=production
- E2E_MODE disabled
- SEED_DEMO disabled
- DEMO_AUTH disabled
- DEMO_CHECKOUT disabled
- PAYMENTS_MODE not equal to demo
- production configuration validation before server import

The production configuration validator also rejects:

- production Stripe test keys
- missing production Stripe configuration
- fixture geocoding
- production demo/test modes

## D9B hardening

The Render staging launcher now explicitly refuses to start when either:

- NODE_ENV=production
- MELEO_DEPLOYMENT_ENV=production

This creates launch-path isolation in both directions:

- production launcher requires production identity
- staging launcher refuses production identity

## Runtime configuration guarantees

The D9B self-test also protects representative guarantees for:

- explicit PostgreSQL configuration
- Redis requirement in hosted environments
- S3 storage default in production
- demo feature defaults
- production Stripe live-key enforcement

## Result

RC3-D9B production environment isolation: COMPLETE.
