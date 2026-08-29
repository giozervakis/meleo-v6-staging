-- MELEO RC2-A9 - Stripe webhook ordering metadata
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS last_stripe_event_created bigint;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS last_stripe_event_id text;

CREATE INDEX IF NOT EXISTS subscriptions_stripe_event_order_idx
  ON subscriptions(stripe_subscription_id,last_stripe_event_created DESC);
