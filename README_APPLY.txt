MELEO v6 — ONE ACCOUNT / CONSUMER + PROFESSIONAL
SAFE SURGICAL UPGRADE

This package does NOT replace your source files.
It surgically edits the latest local main branch and preserves unrelated bug fixes.

WHAT IT IMPLEMENTS
- professional accounts can request services, accept quotes, cancel, review, favorite and use Smart Recovery
- professional personal bookings are separate from incoming professional requests
- self-booking is blocked
- a patient/companion can activate professional capability on the SAME account
- activation leads to the existing mandatory flow: Plan -> Checkout -> Profile -> Verification -> Admin approval
- duplicate email registration explains the existing account role and directs the user to sign in
- admin still sees the account as Professional with its subscription/verification lifecycle
- booking chat distinguishes requester vs provider even when requester is a professional

HOW TO APPLY
1. Open PowerShell in your LOCAL git repository folder.
2. Ensure current work is committed/pushed.
3. Run:
   git status
   git pull origin main
4. Copy apply-consumer-professional.mjs into the repository root.
5. Run:
   node apply-consumer-professional.mjs
6. Review:
   git diff --stat
   git diff
7. Validate:
   node --check server/relational/app.js
   node --check server/relational/repositories.js
   node --check server/relational/authorization.js
   npm run build
8. If all pass:
   git add .
   git commit -m "Add unified consumer and professional account capability"
   git push

IMPORTANT
If the apply script prints FAIL, do NOT commit. Send the FAIL line to ChatGPT.
The script is idempotent: already-applied edits are skipped.
