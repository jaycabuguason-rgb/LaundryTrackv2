-- Migration: Add 'Processing' to the transaction_status enum
-- Run this against your Supabase database to enable the Processing stage.

DO $$
BEGIN
  -- Only add if it doesn't already exist in the enum
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = (
      SELECT oid FROM pg_type WHERE typname = 'transaction_status'
    )
    AND enumlabel = 'Processing'
  ) THEN
    ALTER TYPE public.transaction_status ADD VALUE 'Processing' AFTER 'Drying';
  END IF;
END
$$;
