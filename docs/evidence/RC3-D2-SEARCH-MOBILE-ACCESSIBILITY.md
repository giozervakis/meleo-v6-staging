# RC3-D2 Search / Discovery Mobile & Accessibility Hardening

Status: IMPLEMENTED - real-device staging proof pending.

Scope is intentionally one screen: Search / Discovery and the result cards rendered
inside it. D1 remains closed and is not reopened by this slice.

Implemented:
- Search/Discovery-only responsive CSS namespace
- overflow hardening for hero, toolbar, filters and result cards
- single-column result layout at tablet/mobile widths
- 44px minimum interactive target baseline
- 390px fallback for filters/cards
- stable focus-visible treatment
- results region semantic label + polite live updates
- filter toggle `aria-pressed` state
- accessible result-card label
- long-text wrapping protections
- no broad/global M1/M2 CSS resurrection

Runtime acceptance still required on staging:
- 320 / 375 / 390 / 430 px
- tablet
- desktop
- no horizontal overflow
- filters wrap without clipping
- sort control remains usable
- result cards remain readable
- keyboard focus visible
- result scroll/focus still works
- EL and EN both visually sound

This is not a claim of full WCAG conformance or application-wide accessibility.
