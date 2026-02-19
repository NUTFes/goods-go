-- Manual verification SQL for RBAC/RLS/Triggers/Auth sync
-- Usage:
--   1) Apply migrations first: `mise run supabase:db:reset`
--   2) Run this file in psql as a privileged user (e.g. postgres)
--   3) For Auth trigger verification, also create a user from Supabase Studio/Auth UI

-- ============================================================
-- 0) Seed minimum verification data (idempotent)
-- ============================================================
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a0', 'authenticated', 'authenticated', 'admin@test.local',  '{}'::jsonb, '{"name":"admin"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-0000000000b0', 'authenticated', 'authenticated', 'leader@test.local', '{}'::jsonb, '{"name":"leader"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-0000000000c0', 'authenticated', 'authenticated', 'user@test.local',   '{}'::jsonb, '{"name":"user"}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.users(user_id, name, email, role)
values
  ('00000000-0000-0000-0000-0000000000a0', 'admin',  'admin@test.local',  0),
  ('00000000-0000-0000-0000-0000000000b0', 'leader', 'leader@test.local', 1),
  ('00000000-0000-0000-0000-0000000000c0', 'user',   'user@test.local',   2)
on conflict (user_id) do update
set
  name = excluded.name,
  email = excluded.email,
  role = excluded.role,
  deleted = null;

insert into public.items(name)
values ('verify-item-a')
on conflict do nothing;

insert into public.locations(name)
values ('verify-loc-from')
on conflict do nothing;

insert into public.locations(name)
values ('verify-loc-to')
on conflict do nothing;

insert into public.tasks(
  event_day_type,
  item_id,
  quantity,
  from_location_id,
  to_location_id,
  scheduled_start_time,
  scheduled_end_time,
  created_user_id,
  leader_user_id,
  current_status
)
select
  1,
  (select item_id from public.items where name = 'verify-item-a' and deleted is null limit 1),
  1,
  (select location_id from public.locations where name = 'verify-loc-from' and deleted is null limit 1),
  (select location_id from public.locations where name = 'verify-loc-to' and deleted is null limit 1),
  '09:00'::time,
  '10:00'::time,
  '00000000-0000-0000-0000-0000000000a0',
  '00000000-0000-0000-0000-0000000000b0',
  0
where not exists (
  select 1
  from public.tasks t
  where t.created_user_id = '00000000-0000-0000-0000-0000000000a0'
    and t.leader_user_id = '00000000-0000-0000-0000-0000000000b0'
    and t.deleted is null
);

-- ============================================================
-- 1) Metadata checks: RLS / policies / triggers / functions / grants
-- ============================================================

-- 1-1) RLS enabled/forced status
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('users', 'items', 'locations', 'tasks', 'task_activities')
order by c.relname;

-- 1-2) RLS policy list
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('users', 'items', 'locations', 'tasks', 'task_activities')
order by tablename, policyname;

-- 1-3) Trigger list
select
  event_object_schema,
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where event_object_schema in ('public', 'auth')
order by event_object_schema, event_object_table, trigger_name;

-- 1-4) SECURITY DEFINER functions
select
  n.nspname as schema_name,
  p.proname as function_name,
  r.rolname as owner_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public'
  and p.prosecdef
order by p.proname;

-- 1-5) Table privileges for authenticated
select
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where grantee = 'authenticated'
  and table_schema = 'public'
  and table_name in ('users', 'items', 'locations', 'tasks', 'task_activities')
order by table_name, privilege_type;

-- ============================================================
-- 2) Behavior checks with authenticated role + jwt claims
-- ============================================================
-- NOTE:
--   - execute each block as a privileged user (postgres) in one session
--   - each block uses BEGIN/ROLLBACK to keep db clean

-- 2-1) USER can SELECT public tables
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c0","role":"authenticated"}',
  true
);

select 'user_select_items' as check_name, count(*) as rows_count from public.items;
select 'user_select_locations' as check_name, count(*) as rows_count from public.locations;
select 'user_select_tasks' as check_name, count(*) as rows_count from public.tasks;
select 'user_select_task_activities' as check_name, count(*) as rows_count from public.task_activities;
rollback;

-- 2-2) Non-admin cannot write items/locations (expect ERRORs)
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c0","role":"authenticated"}',
  true
);

-- expect: permission denied by RLS/policy
insert into public.items(name) values ('verify-user-write-items');
update public.items set name = 'verify-user-write-items-2' where name = 'verify-item-a';
delete from public.items where name = 'verify-user-write-items';
rollback;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c0","role":"authenticated"}',
  true
);

-- expect: permission denied by RLS/policy
insert into public.locations(name) values ('verify-user-write-locations');
update public.locations set name = 'verify-user-write-locations-2' where name = 'verify-loc-from';
delete from public.locations where name = 'verify-user-write-locations';
rollback;

-- 2-3) Non-admin cannot INSERT/DELETE tasks (expect ERRORs)
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}',
  true
);

-- expect: permission denied by RLS/policy
insert into public.tasks(
  event_day_type,
  item_id,
  quantity,
  from_location_id,
  to_location_id,
  scheduled_start_time,
  scheduled_end_time,
  created_user_id,
  leader_user_id,
  current_status
)
select
  1,
  (select item_id from public.items where name = 'verify-item-a' and deleted is null limit 1),
  1,
  (select location_id from public.locations where name = 'verify-loc-from' and deleted is null limit 1),
  (select location_id from public.locations where name = 'verify-loc-to' and deleted is null limit 1),
  '09:00'::time,
  '10:00'::time,
  '00000000-0000-0000-0000-0000000000b0',
  '00000000-0000-0000-0000-0000000000b0',
  0;

delete from public.tasks
where created_user_id = '00000000-0000-0000-0000-0000000000a0';
rollback;

-- 2-4) Leader can update current_status only
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}',
  true
);

-- expect: success
update public.tasks
set current_status = case when current_status = 0 then 1 else 0 end
where created_user_id = '00000000-0000-0000-0000-0000000000a0'
  and leader_user_id = '00000000-0000-0000-0000-0000000000b0';
rollback;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}',
  true
);

-- expect: ERROR (leader cannot edit note)
update public.tasks
set current_status = case when current_status = 0 then 1 else 0 end,
    note = 'leader-note-should-fail'
where created_user_id = '00000000-0000-0000-0000-0000000000a0'
  and leader_user_id = '00000000-0000-0000-0000-0000000000b0';
rollback;

-- 2-5) DB制約（同一場所禁止 / 時刻前後）
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a0","role":"authenticated"}',
  true
);

-- expect: ERROR (from/to same)
insert into public.tasks(
  event_day_type,
  item_id,
  quantity,
  from_location_id,
  to_location_id,
  scheduled_start_time,
  scheduled_end_time,
  created_user_id,
  leader_user_id,
  current_status
)
select
  0,
  (select item_id from public.items where name = 'verify-item-a' and deleted is null limit 1),
  1,
  (select location_id from public.locations where name = 'verify-loc-from' and deleted is null limit 1),
  (select location_id from public.locations where name = 'verify-loc-from' and deleted is null limit 1),
  '11:00'::time,
  '12:00'::time,
  '00000000-0000-0000-0000-0000000000a0',
  '00000000-0000-0000-0000-0000000000b0',
  0;
rollback;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a0","role":"authenticated"}',
  true
);

-- expect: ERROR (end <= start)
insert into public.tasks(
  event_day_type,
  item_id,
  quantity,
  from_location_id,
  to_location_id,
  scheduled_start_time,
  scheduled_end_time,
  created_user_id,
  leader_user_id,
  current_status
)
select
  0,
  (select item_id from public.items where name = 'verify-item-a' and deleted is null limit 1),
  1,
  (select location_id from public.locations where name = 'verify-loc-from' and deleted is null limit 1),
  (select location_id from public.locations where name = 'verify-loc-to' and deleted is null limit 1),
  '12:00'::time,
  '12:00'::time,
  '00000000-0000-0000-0000-0000000000a0',
  '00000000-0000-0000-0000-0000000000b0',
  0;
rollback;

-- ============================================================
-- 3) Status-change activity log check
-- ============================================================
-- If you have status-change trigger, after_count should increase by updated rows.
-- If not, after_count stays same (this indicates missing trigger wiring).
select 'task_activities_before' as check_name, count(*) as cnt from public.task_activities;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}',
  true
);

update public.tasks
set current_status = case when current_status = 0 then 1 else 0 end
where created_user_id = '00000000-0000-0000-0000-0000000000a0'
  and leader_user_id = '00000000-0000-0000-0000-0000000000b0';
commit;

select 'task_activities_after' as check_name, count(*) as cnt from public.task_activities;

-- ============================================================
-- 4) Auth trigger check
-- ============================================================
-- Create a new user from Supabase Studio/Auth UI, then run:
select
  user_id,
  name,
  email,
  role,
  created
from public.users
order by created desc
limit 10;
