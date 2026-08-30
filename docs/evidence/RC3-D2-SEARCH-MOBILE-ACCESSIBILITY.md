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

## Pre-closure global language UX refinement

Staging review identified that the language selector belongs in global navigation,
not inside the Home hero.

Implemented:
- removed EL/EN switching from the Home hero
- added one reusable premium LanguageSwitcher to global header actions
- retained i18next persistence and document-language synchronization
- added menu semantics, selected-language state, outside-click and Escape dismissal
- added mobile-safe dropdown positioning
- updated the D1 regression gate so it validates the language capability without
  hard-coding the obsolete Home-hero placement

D2 remains pending real-device staging acceptance after this refinement.

## Final header polish before closure

Real-device review confirmed the global selector worked but remained too utility-like,
and English mode exposed untranslated global navigation.

This final polish:
- upgrades the language trigger/dropdown to a restrained premium MELEO treatment
- removes the utility-style icon
- localizes global Header navigation for EL/EN
- adds responsive compact behavior and reduced-motion support
- preserves the existing language architecture and D2 scope

D2 remains pending final staging visual acceptance.
