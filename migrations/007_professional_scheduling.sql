-- ============================================================
-- MELEO V7
-- 007_professional_scheduling.sql
--
-- Real weekly professional scheduling engine.
--
-- Legacy professionals.availability JSONB remains untouched
-- and is used as a compatibility fallback until a professional
-- saves a weekly schedule.
-- ============================================================


CREATE TABLE IF NOT EXISTS professional_availability_slots (

  id bigserial PRIMARY KEY,

  professional_id text NOT NULL
    REFERENCES professionals(id)
    ON DELETE CASCADE,

  day_of_week smallint NOT NULL
    CHECK (day_of_week BETWEEN 1 AND 7),

  slot_time time NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(
    professional_id,
    day_of_week,
    slot_time
  )
);


CREATE INDEX IF NOT EXISTS
professional_availability_slots_professional_idx
ON professional_availability_slots(
  professional_id,
  day_of_week,
  slot_time
);


CREATE TABLE IF NOT EXISTS professional_availability_exceptions (

  id bigserial PRIMARY KEY,

  professional_id text NOT NULL
    REFERENCES professionals(id)
    ON DELETE CASCADE,

  exception_date date NOT NULL,

  available boolean NOT NULL DEFAULT false,

  slots jsonb NOT NULL DEFAULT '[]'::jsonb,

  note text NOT NULL DEFAULT '',

  created_at timestamptz NOT NULL DEFAULT now(),

  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(
    professional_id,
    exception_date
  )
);


CREATE INDEX IF NOT EXISTS
professional_availability_exceptions_professional_idx
ON professional_availability_exceptions(
  professional_id,
  exception_date
);


-- ------------------------------------------------------------
-- Prevent two active requests for the same professional
-- at the same date/time.
--
-- Cancelled and completed bookings do not reserve the slot.
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- Explicit structured availability engine state.
--
-- Zero weekly slot rows may mean "intentionally closed".
-- Therefore slot existence must not determine whether the
-- structured scheduling engine is active.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS professional_availability_settings (

  professional_id text PRIMARY KEY
    REFERENCES professionals(id)
    ON DELETE CASCADE,

  structured_enabled boolean NOT NULL DEFAULT true,

  updated_at timestamptz NOT NULL DEFAULT now()

);


-- MELEO_AVAILABILITY_DUPLICATE_PREFLIGHT
--
-- Abort before creating the unique index when an existing
-- database contains more than one active booking for the same
-- professional/date/time slot.
--
-- This migration intentionally does NOT delete, cancel, merge,
-- or otherwise mutate conflicting bookings.

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
      'MELEO migration 007 preflight failed: % duplicate active booking slot group(s) exist. Resolve duplicates before retrying migration.',
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