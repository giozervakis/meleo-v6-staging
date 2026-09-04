-- MELEO_SUBSCRIPTION_SCHEDULED_TRANSITION_V1
--
-- Local projection of a future subscription plan transition.
-- Used by demo/staging billing and available for provider reconciliation.

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS scheduled_plan text
    CHECK (scheduled_plan IS NULL OR scheduled_plan IN ('basic','premium')),
  ADD COLUMN IF NOT EXISTS scheduled_plan_effective_at timestamptz;

CREATE INDEX IF NOT EXISTS professionals_scheduled_plan_effective_idx
  ON professionals(scheduled_plan_effective_at)
  WHERE scheduled_plan IS NOT NULL;
