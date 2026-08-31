# RC3-D5S - Completed Booking Repeat-Care i18n

## Scope
Localized the completed-booking repeat-care box without changing repeat-booking behavior or ReviewComposer.

## Changes
- localized familiar-care kicker
- localized repeat-care question
- localized service/address autofill guidance
- localized repeat-visit CTA
- added Greek and English patient.repeatCare translations
- added dedicated RC3-D5S self-test and CI gate entry

## Out of scope
ReviewComposer remains unchanged for a later D5 phase.

## Validation
- rc3-d5r-check
- rc3-d5s-check
- typecheck
- build
- full ci:gate
- git diff --check