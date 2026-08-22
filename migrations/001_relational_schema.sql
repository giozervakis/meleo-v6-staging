BEGIN;


CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('patient','professional','admin')),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  accepted_terms_at timestamptz,
  terms_version text,
  stripe_customer_id text UNIQUE,
  deleted_at timestamptz,
  deletion_pending boolean NOT NULL DEFAULT false,
  deletion_requested_at timestamptz,
  last_totp_step bigint,
  account_status text NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','suspended')),
  suspended_at timestamptz,
  suspension_reason text NOT NULL DEFAULT '',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users(created_at DESC);

CREATE TABLE IF NOT EXISTS professionals (
  id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  specialty text NOT NULL DEFAULT '',
  verified boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  admin_suspended boolean NOT NULL DEFAULT false,
  rating numeric(3,2) NOT NULL DEFAULT 0,
  reviews_count integer NOT NULL DEFAULT 0,
  city text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  country_code text NOT NULL DEFAULT 'gr',
  latitude double precision,
  longitude double precision,
  service_radius_km integer NOT NULL DEFAULT 15,
  subscription_plan text CHECK (subscription_plan IN ('basic','premium')),
  subscription_price numeric(10,2),
  subscription_status text NOT NULL DEFAULT 'none' CHECK (subscription_status IN ('none','pending','active','past_due','cancelled')),
  stripe_status text,
  billing_mode text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_stage text NOT NULL DEFAULT 'plan',
  subscription_since timestamptz,
  stripe_subscription_id text UNIQUE,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  past_due_since timestamptz,
  available text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  credentials jsonb NOT NULL DEFAULT '[]'::jsonb,
  response_time text NOT NULL DEFAULT '',
  years integer NOT NULL DEFAULT 0,
  price numeric(10,2) NOT NULL DEFAULT 0,
  pricing_mode text NOT NULL DEFAULT 'from' CHECK (pricing_mode IN ('from','contact')),
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  availability jsonb NOT NULL DEFAULT '[]'::jsonb,
  show_phone boolean NOT NULL DEFAULT true,
  show_email boolean NOT NULL DEFAULT true,
  prefer_platform_contact boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS professionals_specialty_idx ON professionals(specialty);
CREATE INDEX IF NOT EXISTS professionals_visibility_idx ON professionals(verified, admin_suspended, subscription_status);
CREATE INDEX IF NOT EXISTS professionals_featured_idx ON professionals(featured DESC, rating DESC);
CREATE INDEX IF NOT EXISTS professionals_location_idx ON professionals(country_code, region, city);
CREATE INDEX IF NOT EXISTS professionals_latlon_idx ON professionals(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS professionals_services_gin_idx ON professionals USING gin(services);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  user_agent_hash text
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS one_time_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS one_time_tokens_lookup_idx ON one_time_tokens(type, token_hash) WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS favorites (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  professional_id text NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, professional_id)
);
CREATE INDEX IF NOT EXISTS favorites_user_idx ON favorites(user_id);

CREATE TABLE IF NOT EXISTS bookings (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES users(id),
  professional_id text NOT NULL REFERENCES professionals(id),
  service text NOT NULL,
  visit_date date NOT NULL,
  visit_time time NOT NULL,
  address text NOT NULL DEFAULT '',
  notes_encrypted text NOT NULL DEFAULT '',
  repeat_rule text NOT NULL DEFAULT 'Μία φορά',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','clarification','quoted','accepted','completed','cancelled')),
  base_price numeric(10,2) NOT NULL DEFAULT 0,
  proposed_price numeric(10,2),
  agreed_price numeric(10,2),
  patient_contact_consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_patient_idx ON bookings(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_professional_idx ON bookings(professional_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_schedule_idx ON bookings(visit_date, visit_time);

CREATE TABLE IF NOT EXISTS booking_messages (
  id text PRIMARY KEY,
  booking_id text NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_user_id text NOT NULL REFERENCES users(id),
  sender_role text NOT NULL,
  sender_name text NOT NULL,
  body_encrypted text NOT NULL,
  kind text NOT NULL DEFAULT 'message',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_messages_booking_idx ON booking_messages(booking_id, created_at ASC);

CREATE TABLE IF NOT EXISTS reviews (
  id text PRIMARY KEY,
  booking_id text NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  patient_id text NOT NULL REFERENCES users(id),
  professional_id text NOT NULL REFERENCES professionals(id),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_professional_idx ON reviews(professional_id, created_at DESC);

CREATE TABLE IF NOT EXISTS verification_requests (
  id text PRIMARY KEY,
  professional_id text NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  license_number text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text NOT NULL DEFAULT '',
  reviewed_by text REFERENCES users(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS verification_requests_status_idx ON verification_requests(status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS verification_documents (
  id text PRIMARY KEY,
  professional_id text NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  request_id text REFERENCES verification_requests(id) ON DELETE SET NULL,
  storage_key text NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_documents_prof_idx ON verification_documents(professional_id);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications(user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS support_tickets (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON support_tickets(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id text PRIMARY KEY,
  ticket_id text NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_user_id text NOT NULL REFERENCES users(id),
  sender_role text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON support_messages(ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS reports (
  id text PRIMARY KEY,
  reporter_user_id text NOT NULL REFERENCES users(id),
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status, created_at DESC);

CREATE TABLE IF NOT EXISTS subscriptions (
  id text PRIMARY KEY,
  professional_id text NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  stripe_subscription_id text UNIQUE,
  plan text NOT NULL CHECK (plan IN ('basic','premium')),
  price numeric(10,2) NOT NULL,
  status text NOT NULL,
  stripe_status text,
  billing_mode text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_prof_idx ON subscriptions(professional_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY,
  professional_id text REFERENCES professionals(id) ON DELETE SET NULL,
  invoice_id text NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL,
  provider text NOT NULL DEFAULT 'stripe',
  hosted_invoice_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invoice_id, status)
);
CREATE INDEX IF NOT EXISTS payments_prof_idx ON payments(professional_id, created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  status text NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  actor_id text REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs(actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS professional_analytics_daily (
  professional_id text NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  day date NOT NULL,
  impressions integer NOT NULL DEFAULT 0,
  profile_views integer NOT NULL DEFAULT 0,
  phone_clicks integer NOT NULL DEFAULT 0,
  PRIMARY KEY(professional_id, day)
);
CREATE INDEX IF NOT EXISTS professional_analytics_day_idx ON professional_analytics_daily(day DESC);

CREATE TABLE IF NOT EXISTS analytics_event_dedup (
  fingerprint text PRIMARY KEY,
  professional_id text NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analytics_dedup_expiry_idx ON analytics_event_dedup(expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key text PRIMARY KEY,
  count integer NOT NULL,
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limits_reset_idx ON rate_limits(reset_at);

CREATE TABLE IF NOT EXISTS geocode_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geocode_cache_expiry_idx ON geocode_cache(expires_at);

CREATE TABLE IF NOT EXISTS live_events (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_events_user_idx ON live_events(user_id, id DESC);

COMMIT;
