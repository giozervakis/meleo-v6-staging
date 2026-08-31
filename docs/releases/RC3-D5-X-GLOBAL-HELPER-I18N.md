# RC3-D5X - Global loading and helper i18n

RC3-D5X closes a small global localization and accessibility gap outside the
patient dashboard feature modules.

## Scope

- Localize the React route loading fallback.
- Localize IdentityAvatar fallback alt/aria text.
- Localize file read, image processing canvas, and image load helper errors.
- Add Greek and English global translation resources.
- Add a dedicated D5X self-test and append it to the CI gate.

## Out of scope

Pricing, professional lifecycle labels, commercial copy, and other professional
surfaces remain intentionally outside this patch.

## Validation

- D5W regression self-test
- D5X self-test
- TypeScript typecheck
- Vite production build
- Full CI gate
- git diff --check