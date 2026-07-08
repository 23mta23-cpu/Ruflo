-- Add Stripe customer ID to profiles so list-payment-methods can fetch cards
-- Set by the list-payment-methods Edge Function on first call (lazy creation)
alter table public.profiles
  add column if not exists stripe_customer_id text;
