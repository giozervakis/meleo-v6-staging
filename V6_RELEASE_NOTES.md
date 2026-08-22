# MELEO v6.0 — Production Launch

Η v6.0 είναι το production launch release της σειράς v5.x hardening. Δεν εισάγει νέο business feature ή νέο data model.

## Release freeze

- Κεντρική έκδοση API: `6.0.0` μέσω `server/version.js`.
- Production release channel στα health/root metadata.
- Νέο Redis namespace `meleo:v60:` ώστε το launch release να μην αναμιχθεί με προηγούμενα test keys.
- Release manifest με SHA-256 για τα κρίσιμα source/deployment αρχεία.
- Launch guard που απαιτεί πραγματικό `GO` evidence από v5.7, φρέσκο μέσα στο επιτρεπτό παράθυρο, ανθρώπινη έγκριση και αμετάβλητο manifest.
- Κανένα schema rewrite. Οι υπάρχουσες migrations παραμένουν η πηγή αλήθειας.

## Launch policy

Μετά τη δημιουργία του release manifest δεν αλλάζει αρχείο της release package. Οποιαδήποτε αλλαγή απαιτεί νέο manifest και επανάληψη των release checks.
