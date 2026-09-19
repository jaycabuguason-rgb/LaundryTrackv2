-- Migration: Add paid_at column to transactions table
-- Supports payment-recognized revenue tracking

alter table public.transactions
  add column if not exists paid_at timestamp with time zone;

create index if not exists idx_transactions_paid_at on public.transactions(paid_at);
