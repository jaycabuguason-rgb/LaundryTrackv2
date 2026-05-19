# Supabase Integration Setup

## Environment Variables

Add these to your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Database Setup

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the migration file: `supabase/migrations/001_create_transactions_table.sql`

This will create:
- `transactions` table with all required columns
- Indexes for performance
- Row Level Security policies
- Auto-update trigger for `updated_at`

## Table Structure

```sql
transactions (
  id uuid primary key,
  ticket_id text unique not null,
  customer_name text not null,
  phone_number text,
  member_id uuid,
  wash_type text not null,
  weight_kg numeric,
  addons text[],
  special_instructions text,
  fee numeric not null,
  payment_status text default 'unpaid',
  status text default 'Received',
  void_reason text,
  eta timestamp with time zone,
  arrival_time timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
)
```

## Real-time Features

The Peak Hours chart automatically updates when:
- New transactions are inserted
- Uses Supabase real-time subscriptions
- No page refresh needed

## Fallback Behavior

If Supabase is not configured:
- App falls back to local state/localStorage
- No errors or crashes
- All features continue to work normally
