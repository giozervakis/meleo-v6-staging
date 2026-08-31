# RC3-D5Q - Patient Booking Actions i18n

## Scope
Localized patient booking decision and communication actions without changing booking behavior.

## Changes
- localized quote title and confirmation guidance
- localized accept/reject quote actions
- localized reply textarea aria label and placeholder
- localized send-reply action
- localized cancel-request action
- added Greek and English patient.bookingActions translations
- aligned RC3-D5B accessibility regression assertion with i18n
- added dedicated RC3-D5Q self-test and CI gate entry

## Out of scope
Smart Recovery and repeat-care/completed-booking actions remain for later D5 phases.

## Validation
- rc3-d5b-check
- rc3-d5p-check
- rc3-d5q-check
- typecheck
- build
- full ci:gate
- git diff --check