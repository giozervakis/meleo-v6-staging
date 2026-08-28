-- ============================================================
-- MELEO V7
-- 008_booking_duplicate_preflight.sql
--
-- Immutable follow-up safety migration.
--
-- Migration 007 may already be recorded in schema_migrations on
-- deployed databases. Never rewrite an applied migration.
--
-- This migration:
--   1. aborts if duplicate active booking slots already exist;
--   2. never auto-deletes or auto-cancels bookings;
--   3. ensures the active-slot unique index exists.
-- ============================================================

-- MELEO_BOOKING_DUPLICATE_PREFLIGHT_V2

DO $$
DECLARE
  duplicate_groups integer;
BEGIN
  SELECT count(*)
  INTO duplicate_groups
  FROM (
    SELECT
      professional_id,
      visit_date,
      visit_time
    FROM bookings
    WHERE status IN (
      'pending',
      'clarification',
      'quoted',
      'accepted'
    )
    GROUP BY
      professional_id,
      visit_date,
      visit_time
    HAVING count(*) > 1
  ) AS conflicts;

  IF duplicate_groups > 0 THEN
    RAISE EXCEPTION
      'MELEO migration 008 preflight failed: % duplicate active booking slot group(s) exist. Resolve duplicates before retrying migration.',
      duplicate_groups;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
bookings_professional_active_slot_unique_idx

ON bookings(
  professional_id,
  visit_date,
  visit_time
)

WHERE status IN (
  'pending',
  'clarification',
  'quoted',
  'accepted'
);