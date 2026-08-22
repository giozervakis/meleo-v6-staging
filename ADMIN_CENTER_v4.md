# MELEO Admin Center v4

Το Admin Center είναι χωρισμένο σε:

- **Επισκόπηση**: accounts, professionals, MRR, Premium share, conversion και ποιότητα.
- **Insights**: growth 7/30 ημερών, repeat users, review distribution, top professionals.
- **Μέλη**: αναζήτηση/φίλτρα, account status, plan, verification και διοικητικές ενέργειες.
- **Κρατήσεις**: πλήρες booking lifecycle και GMV ως πληροφοριακό metric.
- **Έσοδα**: MRR, ARR, collected revenue, failed charges, outstanding και subscription mix.
- **Συνδρομές**: Stripe/subscription state και manual synchronization.
- **Verification**: έγγραφα, approvals/rejections και admin notes.
- **Audit Log**: traceability κρίσιμων ενεργειών.

### Manual verification

Ο Admin μπορεί να κάνει manual Verify/Unverify. Η ενέργεια:
- ενημερώνει το professional profile,
- δημιουργεί/ενημερώνει verification record όπου χρειάζεται,
- καταγράφεται στο audit log,
- δεν αλλάζει το subscription plan.

### Suspension

Η αναστολή μέλους:
- θέτει `accountStatus=suspended`,
- αποθηκεύει αιτιολογία/χρόνο,
- τερματίζει τις ενεργές sessions,
- μπορεί να αναιρεθεί από Admin.
