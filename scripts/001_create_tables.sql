-- LaundryTrack core schema for Supabase

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'staff');
  end if;

  if not exists (select 1 from pg_type where typname = 'transaction_status') then
    create type public.transaction_status as enum ('Received', 'Washing', 'Drying', 'Ready', 'Claimed', 'Voided');
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('unpaid', 'paid');
  end if;

  if not exists (select 1 from pg_type where typname = 'pricing_type') then
    create type public.pricing_type as enum ('per-kg', 'per-load', 'per-piece');
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists phone_number text,
  add column if not exists username text,
  add column if not exists avatar_url text,
  add column if not exists role public.user_role not null default 'staff',
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamp with time zone not null default now(),
  add column if not exists updated_at timestamp with time zone not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
      and udt_name <> 'user_role'
  ) then
    alter table public.profiles alter column role drop default;
    alter table public.profiles
      alter column role type public.user_role
      using (
        case
          when lower(coalesce(role::text, 'staff')) = 'admin' then 'admin'::public.user_role
          else 'staff'::public.user_role
        end
      );
    alter table public.profiles alter column role set default 'staff';
  end if;
end
$$;

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id
      and role = 'admin'
      and is_active = true
  );
$$;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_text text := lower(coalesce(new.raw_user_meta_data ->> 'role', 'staff'));
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    phone_number,
    username,
    avatar_url,
    role,
    is_active
  )
  values (
    new.id,
    nullif(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1), 'Admin'),
    new.raw_user_meta_data ->> 'phone_number',
    nullif(new.raw_user_meta_data ->> 'username', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    case
      when role_text = 'admin' then 'admin'::public.user_role
      else 'staff'::public.user_role
    end,
    coalesce((new.raw_user_meta_data ->> 'is_active')::boolean, true)
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    phone_number = excluded.phone_number,
    username = coalesce(excluded.username, public.profiles.username),
    avatar_url = excluded.avatar_url,
    role = excluded.role,
    is_active = excluded.is_active,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_insert_self_or_admin on public.profiles;
create policy profiles_insert_self_or_admin
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

drop policy if exists profiles_delete_admin_only on public.profiles;
create policy profiles_delete_admin_only
  on public.profiles
  for delete
  to authenticated
  using (public.is_admin());

create or replace view public.staff_accounts as
select
  p.id,
  p.email,
  p.full_name,
  p.phone_number,
  p.username,
  p.avatar_url,
  p.is_active,
  p.created_at,
  p.updated_at,
  u.last_sign_in_at
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'staff';

create table if not exists public.loyalty_members (
  id uuid primary key default gen_random_uuid()
);

alter table public.loyalty_members
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists phone_number text,
  add column if not exists stamp_count integer not null default 0,
  add column if not exists rewards_redeemed integer not null default 0,
  add column if not exists preferences text not null default '',
  add column if not exists notes text not null default '',
  add column if not exists date_joined timestamp with time zone not null default now(),
  add column if not exists created_at timestamp with time zone not null default now(),
  add column if not exists updated_at timestamp with time zone not null default now();

create unique index if not exists loyalty_members_phone_unique_idx
  on public.loyalty_members (phone_number)
  where phone_number is not null;

create unique index if not exists loyalty_members_email_unique_idx
  on public.loyalty_members (lower(email))
  where email is not null;

drop trigger if exists loyalty_members_set_updated_at on public.loyalty_members;
create trigger loyalty_members_set_updated_at
  before update on public.loyalty_members
  for each row execute function public.set_updated_at();

alter table public.loyalty_members enable row level security;

drop policy if exists loyalty_members_all_authenticated on public.loyalty_members;
create policy loyalty_members_all_authenticated
  on public.loyalty_members
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.service_types (
  id uuid primary key default gen_random_uuid()
);

alter table public.service_types
  add column if not exists name text,
  add column if not exists description text not null default '',
  add column if not exists price numeric(10, 2) not null default 0,
  add column if not exists pricing_type public.pricing_type not null default 'per-kg',
  add column if not exists is_active boolean not null default true,
  add column if not exists show_price boolean not null default true,
  add column if not exists created_at timestamp with time zone not null default now(),
  add column if not exists updated_at timestamp with time zone not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_types'
      and column_name = 'pricing_type'
      and udt_name <> 'pricing_type'
  ) then
    alter table public.service_types alter column pricing_type drop default;
    alter table public.service_types
      alter column pricing_type type public.pricing_type
      using (
        case
          when lower(replace(coalesce(pricing_type::text, 'per-kg'), '_', '-')) = 'per-load' then 'per-load'::public.pricing_type
          when lower(replace(coalesce(pricing_type::text, 'per-kg'), '_', '-')) = 'per-piece' then 'per-piece'::public.pricing_type
          else 'per-kg'::public.pricing_type
        end
      );
    alter table public.service_types alter column pricing_type set default 'per-kg';
  end if;
end
$$;

create unique index if not exists service_types_name_unique_idx
  on public.service_types (lower(name))
  where name is not null;

drop trigger if exists service_types_set_updated_at on public.service_types;
create trigger service_types_set_updated_at
  before update on public.service_types
  for each row execute function public.set_updated_at();

alter table public.service_types enable row level security;

drop policy if exists service_types_select_authenticated on public.service_types;
create policy service_types_select_authenticated
  on public.service_types
  for select
  to authenticated
  using (true);

drop policy if exists service_types_write_admin on public.service_types;
create policy service_types_write_admin
  on public.service_types
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.add_ons (
  id uuid primary key default gen_random_uuid()
);

alter table public.add_ons
  add column if not exists name text,
  add column if not exists rate numeric(10, 2) not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamp with time zone not null default now(),
  add column if not exists updated_at timestamp with time zone not null default now();

create unique index if not exists add_ons_name_unique_idx
  on public.add_ons (lower(name))
  where name is not null;

drop trigger if exists add_ons_set_updated_at on public.add_ons;
create trigger add_ons_set_updated_at
  before update on public.add_ons
  for each row execute function public.set_updated_at();

alter table public.add_ons enable row level security;

drop policy if exists add_ons_select_authenticated on public.add_ons;
create policy add_ons_select_authenticated
  on public.add_ons
  for select
  to authenticated
  using (true);

drop policy if exists add_ons_write_admin on public.add_ons;
create policy add_ons_write_admin
  on public.add_ons
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid()
);

alter table public.transactions
  add column if not exists ticket_id text,
  add column if not exists customer_name text,
  add column if not exists phone_number text,
  add column if not exists member_id uuid references public.loyalty_members(id) on delete set null,
  add column if not exists wash_type text,
  add column if not exists weight_kg numeric(10, 2),
  add column if not exists addons text[] not null default '{}',
  add column if not exists special_instructions text,
  add column if not exists fee numeric(10, 2) not null default 0,
  add column if not exists status public.transaction_status not null default 'Received',
  add column if not exists payment_status public.payment_status not null default 'unpaid',
  add column if not exists public_tracking_token text not null default encode(gen_random_bytes(16), 'hex'),
  add column if not exists void_reason text,
  add column if not exists eta timestamp with time zone,
  add column if not exists arrival_time timestamp with time zone not null default now(),
  add column if not exists claimed_at timestamp with time zone,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamp with time zone not null default now(),
  add column if not exists created_at timestamp with time zone not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'status'
      and udt_name <> 'transaction_status'
  ) then
    alter table public.transactions alter column status drop default;
    alter table public.transactions
      alter column status type public.transaction_status
      using (
        case
          when status::text in ('Received', 'Washing', 'Drying', 'Ready', 'Claimed', 'Voided') then status::text::public.transaction_status
          else 'Received'::public.transaction_status
        end
      );
    alter table public.transactions alter column status set default 'Received';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'payment_status'
      and udt_name <> 'payment_status'
  ) then
    alter table public.transactions alter column payment_status drop default;
    alter table public.transactions
      alter column payment_status type public.payment_status
      using (
        case
          when lower(coalesce(payment_status::text, 'unpaid')) = 'paid' then 'paid'::public.payment_status
          else 'unpaid'::public.payment_status
        end
      );
    alter table public.transactions alter column payment_status set default 'unpaid';
  end if;
end
$$;

create unique index if not exists transactions_ticket_id_unique_idx
  on public.transactions (ticket_id)
  where ticket_id is not null;

create unique index if not exists transactions_tracking_token_unique_idx
  on public.transactions (public_tracking_token);

create index if not exists transactions_status_idx
  on public.transactions (status);

create index if not exists transactions_arrival_time_idx
  on public.transactions (arrival_time desc);

create index if not exists transactions_member_id_idx
  on public.transactions (member_id);

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;

drop policy if exists transactions_all_authenticated on public.transactions;
create policy transactions_all_authenticated
  on public.transactions
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.stamp_history (
  id uuid primary key default gen_random_uuid()
);

alter table public.stamp_history
  add column if not exists member_id uuid references public.loyalty_members(id) on delete cascade,
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null,
  add column if not exists stamps_added integer not null default 1,
  add column if not exists created_at timestamp with time zone not null default now();

alter table public.stamp_history enable row level security;

drop policy if exists stamp_history_all_authenticated on public.stamp_history;
create policy stamp_history_all_authenticated
  on public.stamp_history
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.reward_history (
  id uuid primary key default gen_random_uuid()
);

alter table public.reward_history
  add column if not exists member_id uuid references public.loyalty_members(id) on delete cascade,
  add column if not exists reward_type text,
  add column if not exists redeemed_at timestamp with time zone not null default now(),
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null;

alter table public.reward_history enable row level security;

drop policy if exists reward_history_all_authenticated on public.reward_history;
create policy reward_history_all_authenticated
  on public.reward_history
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid()
);

alter table public.audit_logs
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null,
  add column if not exists ticket_id text,
  add column if not exists action text,
  add column if not exists staff_name text,
  add column if not exists staff_role public.user_role,
  add column if not exists staff_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists summary text,
  add column if not exists customer_name text,
  add column if not exists payment_status public.payment_status,
  add column if not exists ip_address text,
  add column if not exists notes text not null default '',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamp with time zone not null default now();

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

create index if not exists audit_logs_action_idx
  on public.audit_logs (action);

create index if not exists audit_logs_staff_profile_id_idx
  on public.audit_logs (staff_profile_id);

create index if not exists audit_logs_ticket_id_idx
  on public.audit_logs (ticket_id);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_all_authenticated on public.audit_logs;
create policy audit_logs_all_authenticated
  on public.audit_logs
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid()
);

alter table public.notifications
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists type text not null default 'info',
  add column if not exists is_dismissed boolean not null default false,
  add column if not exists related_ticket_id text,
  add column if not exists related_transaction_id uuid references public.transactions(id) on delete set null,
  add column if not exists created_at timestamp with time zone not null default now(),
  add column if not exists updated_at timestamp with time zone not null default now();

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;

drop policy if exists notifications_all_authenticated on public.notifications;
create policy notifications_all_authenticated
  on public.notifications
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid()
);

alter table public.settings
  add column if not exists key text,
  add column if not exists value jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamp with time zone not null default now(),
  add column if not exists updated_at timestamp with time zone not null default now();

create unique index if not exists settings_key_unique_idx
  on public.settings (key);

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

alter table public.settings enable row level security;

drop policy if exists settings_select_authenticated on public.settings;
create policy settings_select_authenticated
  on public.settings
  for select
  to authenticated
  using (true);

drop policy if exists settings_write_admin on public.settings;
create policy settings_write_admin
  on public.settings
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.service_types (name, description, price, pricing_type, is_active, show_price)
values
  ('Regular', 'Standard wash and dry', 30, 'per-kg', true, true),
  ('Delicate', 'Gentle cycle for delicate fabrics', 40, 'per-kg', true, true),
  ('Express', 'Same-day turnaround', 50, 'per-kg', true, true),
  ('Bulk / Commercial', 'For 10kg and above', 250, 'per-load', false, true)
on conflict do nothing;

insert into public.add_ons (name, rate, is_active)
values
  ('Fabcon', 10, true),
  ('Express (+50%)', 50, true),
  ('Bleach', 15, true),
  ('Starch', 20, true)
on conflict do nothing;

insert into public.settings (key, value)
values
  (
    'pricing',
    jsonb_build_object(
      'pricePerKg', '30',
      'minWeight', '',
      'pricingMode', 'per-kg',
      'loadTiers', jsonb_build_array(
        jsonb_build_object('id', '1', 'name', 'Small Load', 'range', 'below 4 kg', 'price', '80'),
        jsonb_build_object('id', '2', 'name', 'Medium Load', 'range', '4 kg - 7 kg', 'price', '120'),
        jsonb_build_object('id', '3', 'name', 'Large Load', 'range', '7 kg - 10 kg', 'price', '180'),
        jsonb_build_object('id', '4', 'name', 'Bulk / Commercial', 'range', '10 kg+', 'price', '250')
      ),
      'priceDisplayMode', 'show'
    )
  ),
  (
    'loyalty',
    jsonb_build_object(
      'enabled', true,
      'washesPerReward', '10',
      'rewardDescription', 'Free wash'
    )
  ),
  (
    'business_profile',
    jsonb_build_object(
      'shopName', 'Sunshine Laundry Shop',
      'tagline', 'Powered by LaundryTrack',
      'address', '123 Magsaysay Ave, Brgy. Sta. Cruz, Manila',
      'contactNumber', '(02) 8123-4567',
      'email', 'contact@laundrytrack.ph',
      'logoDataUrl', '',
      'receiptFooter', 'Thank you for choosing Sunshine Laundry Shop!',
      'pickupInstructions', 'Present this receipt or QR code upon claiming.'
    )
  )
on conflict (key) do nothing;

create or replace view public.report_daily_sales as
select
  date(arrival_time at time zone 'Asia/Manila') as report_date,
  count(*) as transaction_count,
  coalesce(sum(fee), 0)::numeric(12, 2) as gross_sales,
  coalesce(sum(case when payment_status = 'paid' then fee else 0 end), 0)::numeric(12, 2) as paid_sales,
  coalesce(sum(case when payment_status = 'unpaid' then fee else 0 end), 0)::numeric(12, 2) as unpaid_sales,
  coalesce(sum(weight_kg), 0)::numeric(12, 2) as total_weight_kg
from public.transactions
group by 1;

create or replace view public.report_service_mix as
select
  wash_type,
  count(*) as transaction_count,
  coalesce(sum(fee), 0)::numeric(12, 2) as gross_sales,
  coalesce(avg(fee), 0)::numeric(12, 2) as average_ticket
from public.transactions
group by wash_type;

create or replace view public.report_status_summary as
select
  status,
  count(*) as transaction_count,
  coalesce(sum(fee), 0)::numeric(12, 2) as gross_sales
from public.transactions
group by status;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'loyalty_members',
    'service_types',
    'add_ons',
    'transactions',
    'stamp_history',
    'reward_history',
    'audit_logs',
    'notifications',
    'settings'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$$;
