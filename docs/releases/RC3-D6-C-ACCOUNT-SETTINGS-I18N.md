# RC3-D6C - Account settings and security i18n

RC3-D6C localizes the signed-in account settings surface while leaving
the legal-document body unchanged for a separate legal-content tranche.

## Scope

- Account identity and account-type labels.
- Profile image settings copy.
- Change-password validation, strength and checklist copy.
- GDPR data export labels and feedback.
- Delete-account warning, confirmation and feedback.
- Reuse of existing auth.password translations.
- New accountSettings translation namespace.
- Dedicated D6C self-test and CI gate integration.

## Validation

- D6B regression self-test
- D6C self-test
- TypeScript typecheck
- Vite production build
- Full CI gate
- git diff --check