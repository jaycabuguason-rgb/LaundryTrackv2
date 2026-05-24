-- supabase/migrations/20260524_loyalty_email_stamp_history.sql

-- 1. Add email column to loyalty_members (nullable, unique when set)
alter table public.loyalty_members
  add column if not exists email text;

create unique index if not exists loyalty_members_email_unique_idx
  on public.loyalty_members (lower(email))
  where email is not null;

-- 2. Add rewards_available column (tracks how many unclaimed rewards the member has)
alter table public.loyalty_members
  add column if not exists rewards_available integer not null default 0;

-- 3. Prevent duplicate auto-stamps for the same transaction
create unique index if not exists stamp_history_transaction_id_unique_idx
  on public.stamp_history (transaction_id)
  where transaction_id is not null;

-- 4. Add source and notes columns to stamp_history to distinguish auto vs manual and keep audit logs
alter table public.stamp_history
  add column if not exists source text not null default 'manual'
  check (source in ('auto_claim', 'manual')),
  add column if not exists notes text;

