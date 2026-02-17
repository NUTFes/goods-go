-- RLS enable + policies
-- Roles (public.users.role):
--   0 = Admin  : 全操作可（タスクの備考(note)編集もAdminのみ）
--   1 = Leader : タスクのステータス(current_status)変更のみ可（全タスク対象）
--   2 = User   : 参照のみ

-- =========================================
-- RLS enable
-- =========================================
alter table public.users           enable row level security;
alter table public.items           enable row level security;
alter table public.locations       enable row level security;
alter table public.tasks           enable row level security;
alter table public.task_activities enable row level security;

alter table public.users           force row level security;
alter table public.items           force row level security;
alter table public.locations       force row level security;
alter table public.tasks           force row level security;
alter table public.task_activities force row level security;

-- =========================================
-- Drop existing policies (idempotent)
-- =========================================
drop policy if exists users_select_own_or_admin              on public.users;
drop policy if exists users_update_own_or_admin              on public.users;

drop policy if exists items_select_active_or_admin           on public.items;
drop policy if exists items_write_admin_only                 on public.items;

drop policy if exists locations_select_active_or_admin       on public.locations;
drop policy if exists locations_write_admin_only             on public.locations;

drop policy if exists tasks_select_active_or_admin           on public.tasks;
drop policy if exists tasks_insert_admin_only                on public.tasks;
drop policy if exists tasks_update_admin_or_leader           on public.tasks;
drop policy if exists tasks_delete_admin_only                on public.tasks;

drop policy if exists task_activities_select                 on public.task_activities;
drop policy if exists task_activities_insert_admin_or_leader on public.task_activities;

-- =========================================
-- users
-- =========================================
create policy users_select_own_or_admin
on public.users
for select
to authenticated
using (
  public.is_admin() or user_id = auth.uid()
);

create policy users_update_own_or_admin
on public.users
for update
to authenticated
using (
  public.is_admin() or user_id = auth.uid()
)
with check (
  public.is_admin() or user_id = auth.uid()
);

-- =========================================
-- items
-- =========================================
create policy items_select_active_or_admin
on public.items
for select
to authenticated
using (
  public.is_admin() or deleted is null
);

create policy items_write_admin_only
on public.items
for all
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

-- =========================================
-- locations
-- =========================================
create policy locations_select_active_or_admin
on public.locations
for select
to authenticated
using (
  public.is_admin() or deleted is null
);

create policy locations_write_admin_only
on public.locations
for all
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

-- =========================================
-- tasks
-- =========================================
create policy tasks_select_active_or_admin
on public.tasks
for select
to authenticated
using (
  public.is_admin() or deleted is null
);

create policy tasks_insert_admin_only
on public.tasks
for insert
to authenticated
with check (
  public.is_admin()
);

create policy tasks_update_admin_or_leader
on public.tasks
for update
to authenticated
using (
  public.is_admin()
  or (public.is_leader() and deleted is null)
)
with check (
  public.is_admin()
  or (public.is_leader() and deleted is null)
);

create policy tasks_delete_admin_only
on public.tasks
for delete
to authenticated
using (
  public.is_admin()
);

-- =========================================
-- task_activities
-- =========================================
create policy task_activities_select
on public.task_activities
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.tasks t
    where t.task_id = task_activities.task_id
      and t.deleted is null
  )
);

create policy task_activities_insert_admin_or_leader
on public.task_activities
for insert
to authenticated
with check (
  (
    public.is_admin()
    or (public.is_leader() and changed_by_user_id = auth.uid())
  )
  and exists (
    select 1
    from public.tasks t
    where t.task_id = task_activities.task_id
      and t.deleted is null
  )
);
