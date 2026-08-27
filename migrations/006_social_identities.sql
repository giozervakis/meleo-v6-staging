BEGIN;

CREATE TABLE IF NOT EXISTS user_identities (
  id text PRIMARY KEY,

  user_id text NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  provider text NOT NULL
    CHECK (provider IN ('google','apple','facebook')),

  provider_subject text NOT NULL,

  provider_email text,

  provider_email_verified boolean NOT NULL DEFAULT false,

  provider_display_name text,

  provider_avatar_url text,

  created_at timestamptz NOT NULL DEFAULT now(),

  updated_at timestamptz NOT NULL DEFAULT now(),

  last_login_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS
  user_identities_provider_subject_uidx
ON user_identities(provider, provider_subject);

CREATE UNIQUE INDEX IF NOT EXISTS
  user_identities_user_provider_uidx
ON user_identities(user_id, provider);

CREATE INDEX IF NOT EXISTS
  user_identities_user_idx
ON user_identities(user_id);

CREATE INDEX IF NOT EXISTS
  user_identities_provider_email_idx
ON user_identities(lower(provider_email))
WHERE provider_email IS NOT NULL;

COMMIT;
