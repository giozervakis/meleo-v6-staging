MELEO Growth Foundation — Phase 1
=================================
Implements:
- MELEO Trust Score (independent from Premium subscription)
- Care Team using existing Favorites data
- Direct "Ζήτησε ξανά επίσκεψη" with prefilled service/address
- Premium UI blocks for Trust + Care Team

Run only from the repository root:
  node apply-meleo-growth-foundation.mjs

Then STOP and inspect:
  git diff --stat
  git status
  npm run build
  node --check server/relational/app.js

Do not commit helper files.
