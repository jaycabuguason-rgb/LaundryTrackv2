-- Public QR tracking support for LaundryTrack

alter table public.transactions
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists public_tracking_token text unique,
  add column if not exists updated_at timestamp with time zone default now();

update public.transactions
set payment_status = 'unpaid'
where payment_status is null;

update public.transactions
set payment_status = case
  when ticket_id in ('TKT-0001', 'TKT-0004', 'TKT-0007') then 'paid'
  else coalesce(payment_status, 'unpaid')
end
where payment_status is distinct from case
  when ticket_id in ('TKT-0001', 'TKT-0004', 'TKT-0007') then 'paid'
  else coalesce(payment_status, 'unpaid')
end;

update public.transactions
set public_tracking_token = encode(gen_random_bytes(16), 'hex')
where public_tracking_token is null;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transactions_touch_updated_at on public.transactions;
create trigger transactions_touch_updated_at
  before update on public.transactions
  for each row
  execute function public.touch_updated_at();

insert into public.settings (key, value)
values (
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
on conflict (key) do update
set value = public.settings.value || excluded.value;
