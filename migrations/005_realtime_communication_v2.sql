BEGIN;

-- =========================================================
-- MELEO Notifications & Real-Time Communication V2
-- =========================================================


-- ---------------------------------------------------------
-- Notifications: richer lifecycle + deep-link metadata
-- ---------------------------------------------------------

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS action_type text,
  ADD COLUMN IF NOT EXISTS action_id text,
  ADD COLUMN IF NOT EXISTS action_url text;


-- Keep allowed priorities explicit.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname='notifications_priority_check'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_priority_check
      CHECK (
        priority IN (
          'low',
          'normal',
          'high',
          'critical'
        )
      );
  END IF;
END
$$;


CREATE INDEX IF NOT EXISTS
  notifications_user_unread_created_idx
ON notifications(
  user_id,
  is_read,
  created_at DESC
);


CREATE INDEX IF NOT EXISTS
  notifications_action_idx
ON notifications(
  user_id,
  action_type,
  action_id
)
WHERE action_type IS NOT NULL;


-- ---------------------------------------------------------
-- Booking messages: recipient + delivery/read state
-- ---------------------------------------------------------

ALTER TABLE booking_messages
  ADD COLUMN IF NOT EXISTS recipient_user_id text
    REFERENCES users(id) ON DELETE CASCADE,

  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,

  ADD COLUMN IF NOT EXISTS read_at timestamptz;


CREATE INDEX IF NOT EXISTS
  booking_messages_recipient_unread_idx
ON booking_messages(
  recipient_user_id,
  read_at,
  created_at DESC
)
WHERE recipient_user_id IS NOT NULL;


CREATE INDEX IF NOT EXISTS
  booking_messages_booking_recipient_idx
ON booking_messages(
  booking_id,
  recipient_user_id,
  created_at ASC
);


-- ---------------------------------------------------------
-- Backfill recipient_user_id for existing booking messages
-- ---------------------------------------------------------

UPDATE booking_messages m
SET recipient_user_id=
  CASE
    WHEN m.sender_user_id=b.patient_id
      THEN pu.id
    ELSE b.patient_id
  END
FROM bookings b
JOIN professionals p
  ON p.id=b.professional_id
JOIN users pu
  ON pu.id=p.user_id
WHERE
  m.booking_id=b.id
  AND m.recipient_user_id IS NULL;


-- Existing messages predate read tracking.
-- Treat them as already delivered so we do not show
-- thousands of false unread messages after deployment.

UPDATE booking_messages
SET delivered_at=created_at
WHERE delivered_at IS NULL;

UPDATE booking_messages
SET read_at=created_at
WHERE read_at IS NULL;
-- ---------------------------------------------------------
-- Live events indexes
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS
  live_events_user_created_idx
ON live_events(
  user_id,
  created_at DESC
);


COMMIT;