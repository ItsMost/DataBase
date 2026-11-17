-- Phase 1 security: RLS on this app's three tables + private backup bucket.
-- Touches ONLY: public.players_sync, public.expected_today_sync, public.personal_wallet_sync,
-- the 'coach-backups' storage bucket, and storage.objects policies scoped to that bucket.
-- No rows are deleted or modified.

begin;

-- 1) Enable RLS on the three tables
alter table public.players_sync         enable row level security;
alter table public.expected_today_sync  enable row level security;
alter table public.personal_wallet_sync enable row level security;

-- 2) Remove the old "allow everyone" policies on personal_wallet_sync
drop policy if exists "Allow anon select" on public.personal_wallet_sync;
drop policy if exists "Allow anon insert" on public.personal_wallet_sync;
drop policy if exists "Allow anon update" on public.personal_wallet_sync;
drop policy if exists "Allow anon delete" on public.personal_wallet_sync;

-- 3) Revoke table privileges from anon (defense in depth)
revoke all on public.players_sync         from anon;
revoke all on public.expected_today_sync  from anon;
revoke all on public.personal_wallet_sync from anon;

grant select, insert, update, delete on public.players_sync         to authenticated;
grant select, insert, update, delete on public.expected_today_sync  to authenticated;
grant select, insert, update, delete on public.personal_wallet_sync to authenticated;

-- 4) authenticated: full access (the coach is the only account)
create policy "coach_all_players_sync" on public.players_sync
  for all to authenticated using (true) with check (true);

create policy "coach_all_expected_today_sync" on public.expected_today_sync
  for all to authenticated using (true) with check (true);

create policy "coach_all_personal_wallet_sync" on public.personal_wallet_sync
  for all to authenticated using (true) with check (true);

-- 5) Realtime: players_sync was missing from the publication (the app subscribes to it)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'players_sync'
  ) then
    alter publication supabase_realtime add table public.players_sync;
  end if;
end $$;

-- 6) Private storage bucket for weekly backups
insert into storage.buckets (id, name, public)
values ('coach-backups', 'coach-backups', false)
on conflict (id) do nothing;

create policy "coach_backups_select" on storage.objects
  for select to authenticated using (bucket_id = 'coach-backups');

create policy "coach_backups_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'coach-backups');

create policy "coach_backups_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'coach-backups');

commit;
