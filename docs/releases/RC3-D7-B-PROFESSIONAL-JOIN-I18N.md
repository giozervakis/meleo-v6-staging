# RC3-D7B - Professional join journey i18n

RC3-D7B performs the first controlled reduction pass against the D7A
frontend i18n residue baseline.

## Scope

- `BecomeProfessional` existing-professional state.
- Patient-to-professional activation journey.
- Guest professional acquisition journey.
- New `professionalJoin.*` translation namespace in Greek and English.
- D7B self-test and full CI integration.

## Explicit non-scope

- `InlineRegister` field labels and consent copy remain for the next focused pass.
- Other D7A residue clusters remain unchanged.

## Validation

- D7A residue gate
- D7B self-test
- TypeScript typecheck
- Vite production build
- Full CI gate
- git diff --check
