-- Supabase向けスキーマ（Auth連携 + RBAC(3ロール) + RLS + 変更制御トリガ）
-- Roles:
--   0 = Admin  : 全操作可（タスクの備考(note)編集もAdminのみ）
--   1 = Leader : タスクのステータス(current_status)変更のみ可（全タスク対象）
--   2 = User   : 参照のみ（tasksの更新は不可）
--
-- 認証は Supabase Auth (auth.users) を利用し、public.users はプロフィール/権限を保持する。
-- 使い方: Supabase Dashboard → SQL Editor で実行（または migrations に配置）

create extension if not exists pgcrypto;

-- =========================================
-- 共通: modified 自動更新
-- =========================================
create or replace function public.set_modified()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'UPDATE') then
    new.modified := now();
  end if;
  return new;
end;
$$;

-- =========================================
-- users: ユーザー（auth.users と連携）
-- =========================================
create table if not exists public.users (
  user_id       uuid primary key references auth.users(id) on delete cascade, -- auth.users.id と一致
  name          varchar(60)  not null default '（未設定）',  -- 表示名（最大60）
  email         varchar(254),                              -- メール（NULL可 / 空文字は禁止）
  role          smallint     not null default 2,           -- 0=Admin,1=Leader,2=User
  deleted       timestamptz,                               -- 論理削除
  created       timestamptz  not null default now(),
  modified      timestamptz  not null default now(),
  constraint chk_users_role check (role in (0,1,2))
);

-- =========================================
-- RBAC helpers (roles: 0=Admin, 1=Leader, 2=User)
--  - RLSの判定でも使うため、security definer + row_security=off で実装
-- =========================================
create or replace function public.user_role()
returns smallint
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select u.role
  from public.users u
  where u.user_id = auth.uid()
    and u.deleted is null
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(public.user_role() = 0, false)
$$;

create or replace function public.is_leader()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(public.user_role() = 1, false)
$$;

-- =========================================
-- items: 物品マスタ
-- =========================================
create table if not exists public.items (
  item_id    uuid primary key default gen_random_uuid(),
  name       varchar(80) not null,
  deleted    timestamptz,
  created    timestamptz not null default now(),
  modified   timestamptz not null default now()
);

-- =========================================
-- locations: 場所マスタ（階層構造）
-- =========================================
create table if not exists public.locations (
  location_id        uuid primary key default gen_random_uuid(),
  parent_location_id uuid references public.locations(location_id),
  name               varchar(80) not null,
  deleted            timestamptz,
  created            timestamptz not null default now(),
  modified           timestamptz not null default now()
);

-- =========================================
-- tasks: 物品移動タスク
-- =========================================
create table if not exists public.tasks (
  task_id           uuid primary key default gen_random_uuid(),

  -- 日程
  date_type         smallint not null, -- 0=日付(YYYY-MM-DD), 1=日時(timestamptz)
  task_date         date,
  task_datetime     timestamptz,

  -- 種別
  schedule_type     smallint not null, -- 0=準備, 1=片付け

  -- 物品/数量
  item_id           uuid not null references public.items(item_id),
  quantity          integer not null default 1,

  -- 場所（出発/到着）
  from_location_id  uuid not null references public.locations(location_id),
  to_location_id    uuid not null references public.locations(location_id),

  -- 担当
  created_user_id   uuid not null references public.users(user_id),
  leader_user_id    uuid references public.users(user_id),

  -- 状態
  current_status    smallint not null default 0, -- 0=未着手,1=進行中,2=完了
  note              text,                        -- 備考（Adminのみ編集可）

  deleted           timestamptz,
  created           timestamptz not null default now(),
  modified          timestamptz not null default now(),

  constraint chk_tasks_date_type check (date_type in (0,1)),
  constraint chk_tasks_schedule_type check (schedule_type in (0,1)),
  constraint chk_tasks_status check (current_status in (0,1,2)),
  constraint chk_tasks_quantity_positive check (quantity >= 1),

  -- date_type に応じてどちらか必須
  constraint chk_tasks_date_fields check (
    (date_type = 0 and task_date is not null and task_datetime is null)
    or
    (date_type = 1 and task_datetime is not null and task_date is null)
  )
);

-- =========================================
-- task_activities: タスク履歴
-- =========================================
create table if not exists public.task_activities (
  task_activity_id    uuid primary key default gen_random_uuid(),
  task_id             uuid not null references public.tasks(task_id),
  changed_by_user_id  uuid not null references public.users(user_id),
  action              varchar(40) not null,  -- 例: 'status_change', 'edit', etc
  payload             jsonb,                 -- 変更内容（任意）
  created             timestamptz not null default now()
);

-- =========================================
-- Trigger: modified 自動更新
-- =========================================
drop trigger if exists trg_users_set_modified on public.users;
create trigger trg_users_set_modified
before update on public.users
for each row execute function public.set_modified();

drop trigger if exists trg_items_set_modified on public.items;
create trigger trg_items_set_modified
before update on public.items
for each row execute function public.set_modified();

drop trigger if exists trg_locations_set_modified on public.locations;
create trigger trg_locations_set_modified
before update on public.locations
for each row execute function public.set_modified();

drop trigger if exists trg_tasks_set_modified on public.tasks;
create trigger trg_tasks_set_modified
before update on public.tasks
for each row execute function public.set_modified();

-- =========================================
-- Check constraints (既存DBでも安全に適用できるよう DO で付与)
-- =========================================
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_users_email_not_blank'
  ) then
    alter table public.users
      add constraint chk_users_email_not_blank
      check (email is null or btrim(email) <> '');
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_items_name_not_blank'
  ) then
    alter table public.items
      add constraint chk_items_name_not_blank
      check (btrim(name) <> '');
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_locations_name_not_blank'
  ) then
    alter table public.locations
      add constraint chk_locations_name_not_blank
      check (btrim(name) <> '');
  end if;
end$$;

-- =========================================
-- Indexes / Uniques
-- =========================================

-- users: 有効（deleted IS NULL）かつ email IS NOT NULL のみユニーク
create unique index if not exists uq_users_email_active
on public.users (lower(btrim(email)))
where deleted is null and email is not null;

-- items: 有効レコードのみ name ユニーク
create unique index if not exists uq_items_name_active
on public.items (lower(btrim(name)))
where deleted is null and name is not null;

-- locations:
-- 1) ルート（parent IS NULL）での name ユニーク（有効のみ）
create unique index if not exists uq_locations_root_name_active
on public.locations (lower(btrim(name)))
where deleted is null and parent_location_id is null and name is not null;

-- 2) 同じ親（同階層）内での name ユニーク（有効のみ）
create unique index if not exists uq_locations_sibling_name_active
on public.locations (parent_location_id, lower(btrim(name)))
where deleted is null and parent_location_id is not null and name is not null;

-- tasks: 検索用
create index if not exists idx_tasks_item_id on public.tasks(item_id);
create index if not exists idx_tasks_from_location_id on public.tasks(from_location_id);
create index if not exists idx_tasks_to_location_id on public.tasks(to_location_id);
create index if not exists idx_tasks_task_date on public.tasks(task_date);
create index if not exists idx_tasks_task_datetime on public.tasks(task_datetime);

-- task_activities: 検索用
create index if not exists idx_task_activities_task_id on public.task_activities(task_id);
create index if not exists idx_task_activities_changed_by on public.task_activities(changed_by_user_id);
