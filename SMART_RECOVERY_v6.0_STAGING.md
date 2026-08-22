# MELEO Smart Recovery — v6.0 staging

- Fixes quote acceptance compatibility (`decision: accept` and legacy `accept: true`).
- Allows patient cancellation through accepted status.
- After cancellation, suggests up to three verified professionals for the same specialty/service, prioritizing the same city.
- Re-sends the same request as a new booking, preserving the cancelled booking and linking it with `recovery_parent_id`.
- Adds audit event `booking.recovery`.
