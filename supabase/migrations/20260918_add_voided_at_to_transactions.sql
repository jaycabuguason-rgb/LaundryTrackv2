-- Migration: Add voided_at column to transactions table
-- Supports durable lifecycle timestamps for terminal transaction events

alter table public.transactions
  add column if not exists voided_at timestamp with time zone;

create index if not exists idx_transactions_voided_at on public.transactions(voided_at);
