# RC3-D6D - Legal chrome i18n

RC3-D6D localizes the legal-page navigation and document chrome without
translating or modifying the substantive legal document bodies.

## Scope

- Back navigation.
- Legal section kicker.
- Terms, privacy and cookies document titles.
- Terms version label.
- Missing-provider warning and legal configuration placeholders.
- New legalUi translation namespace.
- Dedicated D6D self-test and CI gate integration.

## Explicit non-scope

The substantive Terms of Use, Privacy Policy and Cookies text remains
unchanged in this tranche and is protected by regression assertions.

## Validation

- D6C regression self-test
- D6D self-test
- TypeScript typecheck
- Vite production build
- Full CI gate
- git diff --check