ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recovery_parent_id text REFERENCES bookings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS bookings_recovery_parent_idx ON bookings(recovery_parent_id) WHERE recovery_parent_id IS NOT NULL;
