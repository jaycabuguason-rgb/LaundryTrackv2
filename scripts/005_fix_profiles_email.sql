-- Fix missing profiles.email column for existing databases
-- Safe to run multiple times.

alter table public.profiles
  add column if not exists email text;

update public.profiles as profiles
set email = users.email
from auth.users as users
where users.id = profiles.id
  and profiles.email is distinct from users.email;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_text text := lower(coalesce(new.raw_user_meta_data ->> 'role', 'staff'));
  normalized_username text := nullif(new.raw_user_meta_data ->> 'username', '');
  normalized_full_name text := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(new.email, ''), '@', 1),
    'Staff'
  );
  normalized_phone text := new.raw_user_meta_data ->> 'phone_number';
  normalized_avatar text := new.raw_user_meta_data ->> 'avatar_url';
  normalized_email text := nullif(new.email, '');
  normalized_role public.user_role := case
    when role_text = 'admin' then 'admin'::public.user_role
    else 'staff'::public.user_role
  end;
  normalized_is_active boolean := coalesce((new.raw_user_meta_data ->> 'is_active')::boolean, true);
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
    normalized_email,
    normalized_full_name,
    normalized_phone,
    normalized_username,
    normalized_avatar,
    normalized_role,
    normalized_is_active
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
    updated_at = now()
  where public.profiles.email is distinct from excluded.email
    or public.profiles.full_name is distinct from excluded.full_name
    or public.profiles.phone_number is distinct from excluded.phone_number
    or public.profiles.username is distinct from excluded.username
    or public.profiles.avatar_url is distinct from excluded.avatar_url
    or public.profiles.role is distinct from excluded.role
    or public.profiles.is_active is distinct from excluded.is_active;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.sync_profile_from_auth_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_from_auth_user();

create or replace view public.staff_accounts
with (security_invoker = true)
as
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
left join auth.users u on u.id = p.id
where p.role = 'staff';
