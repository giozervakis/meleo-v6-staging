# RC3-D5P - Patient Bookings Workspace i18n

## Scope
Localized the first patient bookings workspace block without changing booking behavior.

## Changes
- localized patient dashboard tablist aria label
- localized bookings kicker, title and total count
- localized base-price "From" label
- localized details open/close actions
- localized professional, request and need-description labels
- added Greek and English patient.bookings translations
- added dedicated RC3-D5P regression self-test
- future-proofed the RC3-D5O ci:gate sequence assertion

## Out of scope
Quote decision, reply/cancel actions, Smart Recovery and completed-booking repeat-care copy remain for later D5 phases.

## Validation
- rc3-d5o-check
- rc3-d5p-check
- typecheck
- build
- full ci:gate
- git diff --check