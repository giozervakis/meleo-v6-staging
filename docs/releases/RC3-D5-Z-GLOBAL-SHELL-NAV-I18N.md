# RC3-D5Z - Global shell and navigation i18n

RC3-D5Z localizes the application shell outside feature-specific pages.

## Scope

- Footer navigation, legal labels, contact labels, disclaimer, VAT label and terms version.
- Header account labels, notification copy, account actions and menu accessibility labels.
- Mobile navigation titles, helper text and guest-account copy.
- Greek and English shell translation namespace.
- Dedicated D5Z self-test and CI gate integration.

## Out of scope

Authentication/password-strength copy and checkout/email-return feedback remain for
the next focused localization patch.

## Validation

- D5Y regression self-test
- D5Z self-test
- TypeScript typecheck
- Vite production build
- Full CI gate
- git diff --check