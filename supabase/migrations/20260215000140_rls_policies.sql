-- 20260215000140_rls_policies.sql
-- RLS enable + policies（anonは使わない前提）

alter table public.users enable row level security;
alter table public.items enable row level security;
alter table public.locations enable row level security;
alter table public.tasks enable row level security;
alter table public.task_activities enable row level security;

-- users:
drop policy
if exists users_select_own_or_admin on public.users;
create policy users_select_own_or_admin
on public.users
for
select
    to authenticated
using
(user_id = auth.uid
() or public.is_admin
());

drop policy
if exists users_update_own_or_admin on public.users;
create policy users_update_own_or_admin
on public.users
for
update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check
(user_id = auth.uid
() or public.is_admin
());

-- items: 認証ユーザーは閲覧、Adminのみ書き込み
drop policy
if exists items_select on public.items;
create policy items_select
on public.items
for
select
    to authenticated
using
(deleted is null);

drop policy
if exists items_admin_write on public.items;
create policy items_admin_write
on public.items
for all
to authenticated
using
(public.is_admin
())
with check
(public.is_admin
());

-- locations: 認証ユーザーは閲覧、Adminのみ書き込み
drop policy
if exists locations_select on public.locations;
create policy locations_select
on public.locations
for
select
    to authenticated
using
(deleted is null);

drop policy
if exists locations_admin_write on public.locations;
create policy locations_admin_write
on public.locations
for all
to authenticated
using
(public.is_admin
())
with check
(public.is_admin
());

-- tasks:
drop policy
if exists tasks_select on public.tasks;
create policy tasks_select
on public.tasks
for
select
    to authenticated
using
(deleted is null);

drop policy
if exists tasks_admin_insert on public.tasks;
create policy tasks_admin_insert
on public.tasks
for
insert
to authenticated
with check (public.
is_admin()
);

drop policy
if exists tasks_admin_delete on public.tasks;
create policy tasks_admin_delete
on public.tasks
for
delete
to authenticated
using (public.is_admin());

drop policy
if exists tasks_update_admin_or_leader on public.tasks;
create policy tasks_update_admin_or_leader
on public.tasks
for
update
to authenticated
using (
  deleted is null
    and (public.is_admin() or public.is_leader())
)
with check
(
  deleted is null
  and
(public.is_admin
() or public.is_leader
())
);

-- task_activities:
drop policy
if exists task_activities_select on public.task_activities;
create policy task_activities_select
on public.task_activities
for
select
    to authenticated
using
(
  exists
(
    select 1
from public.tasks t
where t.task_id = task_activities.task_id
    and t.deleted is null
  )
);

drop policy
if exists task_activities_insert_from_tasks_trigger on public.task_activities;
create policy task_activities_insert_from_tasks_trigger
on public.task_activities
for
insert
to authenticated
with check (
pg_trigger_depth()
> 0
  and operator_user_id = auth.uid
()
);

drop policy
if exists task_activities_admin_write on public.task_activities;
create policy task_activities_admin_write
on public.task_activities
for
update,
delete
to authenticated
using (public.is_admin())
with check
(public.is_admin
());
