# RC3-D5-A — Patient Dashboard shell mobile / accessibility

Status: IMPLEMENTED — REAL-DEVICE STAGING PROOF PENDING

Baseline: `26b5daf405eb3f9d0b736c8fc77b6de4de76da08`

Scope is intentionally limited to the Patient Dashboard shell, hero, metrics, next-care panel, attention panel and section navigation.

Implemented:
- scoped responsive and overflow hardening
- 44px interactive target baseline and 16px mobile form controls
- responsive hero, metrics, next-care and action layouts
- accessible dashboard overview label
- next-care heading relationship
- attention live-status semantics
- patient section tablist/tab/aria-selected baseline
- reduced-motion handling

Explicitly unchanged in D5-A:
- booking/recovery business logic
- message send/read business logic
- care-team actions
- detailed booking cards
- user-generated content
- broad application CSS

Not claimed:
- application-wide WCAG compliance
- exhaustive device matrix
- D5 closure
