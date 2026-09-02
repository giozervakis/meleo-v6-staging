-- MELEO_EMAIL_JOB_DEDUP_V1
--
-- D10H.2
--
-- Optional durable business-event identity for background jobs.
-- NULL preserves repeatable-job semantics.
-- Explicit identity provides durable idempotency.

ALTER TABLE background_jobs
ADD COLUMN IF NOT EXISTS dedup_key text;

CREATE UNIQUE INDEX IF NOT EXISTS
background_jobs_job_type_dedup_key_unique_idx
ON background_jobs(
  job_type,
  dedup_key
)
WHERE dedup_key IS NOT NULL;
