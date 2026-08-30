# RC3-D1 Home Mobile / Accessibility / i18n Foundation

Status: IMPLEMENTED - real-device staging proof pending.

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
