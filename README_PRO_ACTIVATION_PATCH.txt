MELEO — Professional activation + admin decision notifications

Apply from the repository root:
  node apply-professional-activation-notifications.mjs

Then verify BEFORE commit:
  git diff --stat
  node --check server/relational/app.js
  node --check server/mail.js
  npm run build
  git status

What this patch changes:
- Professional Dashboard label appears only after active/past_due subscription + verified + onboardingStage=approved.
- In-progress professional onboarding is labeled "Ολοκλήρωση επαγγελματικής εγγραφής".
- Admin rejection reason is mandatory.
- Backend blocks approval without active/past_due subscription.
- Approve/reject sends in-app notification.
- Approve/reject sends transactional email through existing mail.verificationDecision.
- Approval email tells user where to find Professional Dashboard.
- Rejection email includes the admin's reason.
