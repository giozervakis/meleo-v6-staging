# RC3-D8H - Professional Billing Residue i18n

Localized the remaining user-facing Greek literals in ProfessionalBilling.

Covered:
- fallback BASIC and PREMIUM plan features
- subscription status labels
- invoice status labels
- scheduled-change "Until" label
- recommended plan badge

Implementation:
- fallback plans are created through a translation-aware factory
- status helpers receive the translation function explicitly
- configured server plan data remains untouched
- Stripe/domain status values remain unchanged

RC3-D7A baseline remains immutable.
