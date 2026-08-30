# RC3-D1 Home Mobile / Accessibility / i18n Foundation

Status: FULLY CLOSED.

Scope is intentionally one screen: the public Home experience and its primary search
control. This follows the RC3-D rule: one screen -> deploy -> real-device check -> next.

Implemented:
- i18next + react-i18next foundation
- Greek default and fallback
- English language option with local persistence
- document `lang` synchronization
- translated Home UI chrome and primary search labels/messages
- accessible language toggle state
- search landmark and explicit label/control associations
- polite/alert semantics for geolocation feedback
- 44px touch-target baseline
- targeted responsive rules for <=760px and <=390px
- no resurrection of the failed broad M1/M2 CSS package

Evidence boundary:
- specialty/service catalog values remain domain data and are not translated in D1
- professional-generated/dynamic content is not auto-translated
- global header/footer and authenticated screens are outside this slice
- D1 is not FULLY CLOSED until staging is checked at 320/375/390/430px and desktop,
  including no horizontal overflow, keyboard focus, search controls, and EL/EN persistence.

## Real-device feedback correction pass

Observed during staging review:
- Home search navigated to Search without reliably preserving the submitted criteria.
- Search-page searches did not reliably move focus/viewport to the results section.
- English mode still displayed canonical Greek specialty/service catalog labels.
- Result-card platform chrome and catalog-derived content remained Greek.

Correction:
- Home now submits the exact criteria object, loads those results, then performs a
  one-time Search-page result handoff.
- Search uses an explicit delayed viewport offset + focus target after result loading.
- Canonical Greek catalog values remain unchanged for backend/API compatibility while
  display labels are localized to English.
- Search-page platform chrome is localized.
- Result-card platform labels, catalog services, price labels/notes and generic
  Smart Match copy are localized.
- User-generated names, locations and arbitrary free-text profile content are not
  machine-translated.

Status remains: FULLY CLOSED.
## Real-device staging acceptance - 2026-08-30

User validation confirmed the corrected D1 flows are acceptable to proceed:
- Home search preserves submitted criteria and opens the Search experience with matching results.
- Search-page search moves the viewport/focus to the result section after loading.
- English specialty/service selectors display localized labels while canonical backend values remain unchanged.
- English discovery/result-card platform chrome is localized.
- D1 mobile/accessibility/i18n foundation is accepted for progression.

## Closure

RC3-D1 is FULLY CLOSED.

Closure scope:
- Home responsive foundation
- Home primary-search accessibility
- EL default/fallback + EN persistence
- Home-to-Search criteria handoff
- Search result scroll/focus behavior
- localized specialty/service display labels
- localized Search/discovery platform chrome
- localized result-card platform chrome

Evidence boundaries remain:
- user-entered names, locations and arbitrary free-text profile content are not machine-translated
- specialty/service canonical backend values remain Greek identifiers by design
- this closure does not claim full application-wide i18n or WCAG conformance
- authenticated dashboards and remaining public screens continue in later RC3-D slices
