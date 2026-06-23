-- Migration 021: Add unique constraint to pro_subscriptions.provider_id
--
-- stripe-webhook uses upsert({ onConflict: "provider_id" }) to keep one
-- subscription row per provider. PostgreSQL requires a unique index or
-- constraint on the conflict column — without this the upsert raises
-- "there is no unique or exclusion constraint matching the ON CONFLICT specification".

alter table public.pro_subscriptions
  add constraint pro_subscriptions_provider_id_unique unique (provider_id);
