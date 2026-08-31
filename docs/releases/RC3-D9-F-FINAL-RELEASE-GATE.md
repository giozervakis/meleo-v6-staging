# RC3-D9F - Final Release Go/No-Go and Promotion Gate

## Objective

Provide the final safety boundary between release candidate
`7.0.0-rc.2` and production release `7.0.0`.

## Launch guard hardening

Historical v6 release identity is removed from the launch guard.

Release tag, manifest filename and report identity derive from package.json.

## Manifest channel

- RC versions use `release-candidate`.
- Final versions use `production`.

## Final promotion gate

Promotion requires:

- package version 7.0.0-rc.2
- NODE_ENV=production
- MELEO_DEPLOYMENT_ENV=production
- LAUNCH_APPROVED=YES
- PROMOTE_RELEASE=YES
- fresh release GO evidence
- zero blockers
- RC manifest matching Git HEAD
- production preflight evidence
- TLS/domain evidence
- infrastructure evidence
- Stripe evidence
- backup evidence
- restore evidence
- critical E2E evidence
- DR evidence gate
- signed DR evidence manifest

The promotion gate never mutates package.json.

RC3-D9F final release promotion gate: COMPLETE.
