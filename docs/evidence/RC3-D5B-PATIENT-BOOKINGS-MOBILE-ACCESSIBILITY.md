# RC3-D5-B — Patient bookings workspace mobile / accessibility
Status: IMPLEMENTED — REAL-DEVICE STAGING PROOF PENDING
Baseline: `752b66ba5bacc5d8d4c0d8606c92b3c0f2a490fe`
Scope: patient booking cards and expanded booking-detail workspace only.

Implemented:
- keyboard-operable expandable booking cards
- aria-expanded state on card/details control
- accessible reply textarea label
- recovery loading aria-busy state
- scoped mobile overflow/layout hardening for booking cards, details, quote/reply, recovery and repeat-care areas
- 600px and 390px targeted layouts

Business behavior is preserved. Quote decisions, cancellation, replies, recovery, calendar actions, repeat booking and review logic are not rewritten.
Not claimed: messages workspace hardening, application-wide WCAG, exhaustive device matrix, D5 closure.
