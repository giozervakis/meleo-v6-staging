BEGIN;

CREATE TABLE IF NOT EXISTS background_jobs (
  id text PRIMARY KEY,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  priority integer NOT NULL DEFAULT 100,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS background_jobs_ready_idx ON background_jobs(status, run_at, priority, created_at) WHERE status='pending';
CREATE INDEX IF NOT EXISTS background_jobs_failed_idx ON background_jobs(status, updated_at DESC) WHERE status='failed';
CREATE INDEX IF NOT EXISTS background_jobs_processing_idx ON background_jobs(locked_at) WHERE status='processing';

COMMIT;
