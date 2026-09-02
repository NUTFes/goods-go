-- タスク写真のメタデータと参照権限を追加する。
-- 画像本体はprivate Supabase Storageへ保存し、DBには導出可能なObject keyを持たせない。

create table public.task_photos (
  photo_id uuid primary key,
  task_id uuid not null references public.tasks(task_id) on delete cascade,
  sort_order integer not null,
  width integer not null,
  height integer not null,
  created_by_user_id uuid not null references public.users(user_id),
  created_at timestamptz not null default now(),
  deleted_by_user_id uuid references public.users(user_id),
  deleted_at timestamptz,
  constraint chk_task_photos_sort_order check (sort_order >= 0),
  constraint chk_task_photos_dimensions check (
    width between 1 and 1920
    and height between 1 and 1920
    and width::bigint * height::bigint <= 3686400
  ),
  constraint chk_task_photos_deleted_metadata check (
    (deleted_at is null and deleted_by_user_id is null)
    or (deleted_at is not null and deleted_by_user_id is not null)
  )
);

comment on table public.task_photos is 'タスク写真のメタデータ。画像本体はprivate Storageへ保存する。';
comment on column public.task_photos.sort_order is 'タスク内の登録順。論理削除後も過去の値を再利用しない。';

create unique index uq_task_photos_active_sort_order
on public.task_photos (task_id, sort_order)
where deleted_at is null;

alter table public.task_photos enable row level security;
alter table public.task_photos force row level security;

create policy task_photos_select_active
on public.task_photos
for select
to authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.tasks t
    where t.task_id = task_photos.task_id
      and t.deleted is null
  )
);

revoke all on table public.task_photos from anon, authenticated;
grant select on table public.task_photos to authenticated;
grant select on table public.task_photos to service_role;
