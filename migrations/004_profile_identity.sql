BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_key text,
  ADD COLUMN IF NOT EXISTS profile_photo_key text,
  ADD COLUMN IF NOT EXISTS profile_photo_mime text,
  ADD COLUMN IF NOT EXISTS profile_photo_version integer NOT NULL DEFAULT 0;

COMMIT;