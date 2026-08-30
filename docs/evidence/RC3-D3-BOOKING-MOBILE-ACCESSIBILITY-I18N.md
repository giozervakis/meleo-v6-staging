# RC3-D3 — Booking mobile / accessibility / i18n

Status: IMPLEMENTED — REAL-DEVICE STAGING PROOF PENDING

Baseline: `9c9894f79ce93eae27e63e15d6972ab8a784dfe9`

Scope is intentionally limited to the booking flow.

Implemented:
- scoped responsive CSS; 44px touch baseline; 16px mobile controls
- overflow hardening without resurrecting M1/M2 global CSS
- loading/error/empty live availability semantics
- slot `aria-pressed`, progress `aria-current`, step focus handoff
- address autocomplete and trimmed required-address gate
- busy semantics for availability/submission
- Greek/English booking platform chrome and locale-aware selected date
- reduced-motion handling

Not claimed yet:
- real-device acceptance at 320/375/390/430
- application-wide WCAG compliance
- translation of professional/user-entered service names
- D3 closure
