-- Audit log schema upgrades for realtime UI support

alter table public.audit_logs
  add column if not exists staff_role public.user_role,
  add column if not exists summary text,
  add column if not exists ip_address text;

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

create index if not exists audit_logs_action_idx
  on public.audit_logs (action);

create index if not exists audit_logs_staff_profile_id_idx
  on public.audit_logs (staff_profile_id);

create index if not exists audit_logs_ticket_id_idx
  on public.audit_logs (ticket_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'audit_logs'
  ) then
    alter publication supabase_realtime add table public.audit_logs;
  end if;
end
$$;
