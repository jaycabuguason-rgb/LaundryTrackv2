-- Create transactions table for LaundryTrack
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  ticket_id text unique not null,
  customer_name text not null,
  phone_number text,
  member_id uuid,
  wash_type text not null,
  weight_kg numeric,
  addons text[],
  special_instructions text,
  fee numeric not null,
  payment_status text default 'unpaid' check (payment_status in ('paid', 'unpaid')),
  status text default 'Received' check (status in ('Received', 'Washing', 'Drying', 'Ready', 'Claimed', 'Voided')),
  void_reason text,
  eta timestamp with time zone,
  arrival_time timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create index on arrival_time for faster queries
create index if not exists idx_transactions_arrival_time on transactions(arrival_time);

-- Create index on status for filtering
create index if not exists idx_transactions_status on transactions(status);

-- Create index on ticket_id for lookups
create index if not exists idx_transactions_ticket_id on transactions(ticket_id);

-- Enable Row Level Security
alter table transactions enable row level security;

-- Create policy to allow all operations for authenticated users
create policy "Allow all operations for authenticated users"
  on transactions
  for all
  using (true)
  with check (true);

-- Create updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_transactions_updated_at
  before update on transactions
  for each row
  execute function update_updated_at_column();
