-- Migration 031: reviews INSERT policy didn't verify a real completed contract
--
-- The original policy (migration 020) only checked `auth.uid() = reviewer_id`
-- — it never verified that `contract_id` refers to an actual completed
-- contract between `reviewer_id` and `reviewed_id`. Any authenticated user
-- could insert a review row against any existing contract_id (theirs or
-- someone else's) naming any reviewed_id, as long as (contract_id,
-- reviewer_id) is unique. On a marketplace where ratings drive matching,
-- that's a straightforward reputation-manipulation vector. Found during a
-- pre-launch security audit.
--
-- Fix: require the contract to be completed and reviewer/reviewed to be the
-- actual two parties on it, in either direction (customer reviews provider,
-- or provider reviews customer — support-chat.tsx confirms both directions
-- are a real product feature).

drop policy if exists "reviews_insert" on public.reviews;

create policy "reviews_insert" on public.reviews
  for insert with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id
        and c.status = 'completed'
        and (
          (c.customer_id = auth.uid() and c.provider_id = reviewed_id)
          or
          (c.provider_id = auth.uid() and c.customer_id = reviewed_id)
        )
    )
  );
