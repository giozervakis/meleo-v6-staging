# RC3-D8O - i18n residue closure

## Status

RC3 frontend i18n residue remediation is CLOSED.

The D7A scanner started with a frozen baseline of 1372 Greek
literal residues.

After the D7/D8 remediation series, the scanner reports 301
remaining baseline residues.

These remaining values are not treated as untranslated interface
copy.

## Classification

The remaining Greek literals are primarily intentional values in
the following categories.

### 1. Canonical domain catalog

src/domain/catalog.ts

Specialties and services use canonical Greek values as application
domain identifiers.

Changing these values solely to reduce an i18n counter could break
stored data, filtering, matching and professional profiles.

### 2. Catalog translation source keys

src/domain/catalog-i18n.ts

Greek strings are source keys used to map canonical Greek catalog
values to English presentation labels.

They are therefore part of the localization architecture rather
than untranslated UI copy.

### 3. Smart Request NLP dictionary

src/features/home/HomeExperience.tsx

Greek phrases are used for intent recognition, specialty matching
and free-text interpretation.

Examples include nursing, physiotherapy, nutrition, psychology,
speech therapy and other care-intent phrases.

These values must remain Greek because they recognize Greek user
input.

### 4. Emergency recognition dictionary

src/features/home/HomeExperience.tsx

Emergency phrases are recognition tokens used to detect potentially
urgent requests.

They are not rendered UI copy and must not be translated as part of
presentation localization.

### 5. Search and availability semantics

src/features/search/SearchPage.tsx
src/App.tsx

Greek stems and phrases are used to interpret availability values
such as today, immediately available and unavailable.

These are matching semantics rather than presentation strings.

### 6. Canonical specialty defaults

Professional and Smart Request flows retain canonical Greek
specialty identifiers where required by existing domain data.

## Closure decision

The objective of the RC3 i18n programme is correct bilingual user
presentation, not a zero Greek-literal source-code count.

Forcing the remaining residue to zero would mix presentation
localization with domain-data migration and NLP redesign.

Those concerns require separate migrations if the canonical domain
model is internationalized in a future release.

## Guard

RC3-D8O adds a closure self-test protecting representative
intentional literals and ensures the completed D8 i18n gates remain
part of ci:gate.

The original RC3-D7A baseline remains immutable.

Final classified baseline residue:

301 / 1372

RC3 D7/D8 i18n remediation: COMPLETE.
