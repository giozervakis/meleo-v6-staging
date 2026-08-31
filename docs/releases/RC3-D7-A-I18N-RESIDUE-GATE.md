# RC3-D7A - Frontend i18n residue gate

RC3-D7A starts the D7 completion/hardening tranche with an automated frontend internationalization residue gate.

## Scope

- Scans `src/**/*.ts` and `src/**/*.tsx`.
- Excludes `src/i18n.ts`, where Greek translations intentionally live.
- Uses the TypeScript AST to inspect JSX text, string literals and template literal text.
- Captures the current residue set as a baseline.
- Allows future residue removal.
- Rejects new or increased Greek literal signatures outside the translation catalog.
- Appends the D7A self-test to the full CI gate.

## Baseline

Current baseline: 1372 Greek literal occurrence(s).

This baseline is an inventory, not approval that every occurrence should remain. Later D7 tranches can migrate these residues into i18n while the gate prevents new hard-coded Greek UI.

## Validation

- D6G regression self-test
- D7A residue self-test
- TypeScript typecheck
- Vite production build
- Full CI gate
- git diff --check
