# RC3-D5R - Smart Recovery i18n

## Scope
Localized the cancelled-booking Smart Recovery experience without changing recovery behavior.

## Changes
- localized Smart Recovery kicker
- localized recovery continuity title and explanation
- localized searching state and find-professionals CTA
- localized no-results state
- localized new-rating fallback
- localized send-same-request action
- added Greek and English patient.recovery translations
- added dedicated RC3-D5R self-test and CI gate entry

## Out of scope
Completed-booking repeat-care and review copy remain for later D5 phases.

## Validation
- rc3-d5b-check
- rc3-d5q-check
- rc3-d5r-check
- typecheck
- build
- full ci:gate
- git diff --check