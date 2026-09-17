-- Migration: Allow anonymous public tracking over Supabase Realtime
-- This policy allows unauthenticated clients (e.g. customers on /track/[token])
-- to receive Postgres CDC Realtime updates for transactions that have an active tracking token.

-- 1. Ensure transactions is added to the supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;
END
$$;

-- 2. Add SELECT policy for anon role so Realtime evaluates authorization successfully
DROP POLICY IF EXISTS "transactions_anon_read_tracking" ON public.transactions;
CREATE POLICY "transactions_anon_read_tracking"
  ON public.transactions
  FOR SELECT
  TO anon
  USING (public_tracking_token IS NOT NULL);

