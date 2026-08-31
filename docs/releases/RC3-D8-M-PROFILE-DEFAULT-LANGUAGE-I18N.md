# RC3-D8M - Profile default language i18n

Localized the public professional-profile language fallback.

Before this tranche, a professional without an explicit languages
array always displayed the Greek literal "Ελληνικά", including when
the interface language was English.

The fallback now uses:

- Greek: Ελληνικά
- English: Greek

via profile.about.defaultLanguage.

No professional language data, domain catalog values, search tokens,
availability matching logic or NLP dictionaries were modified.

RC3-D7A baseline remains immutable.
