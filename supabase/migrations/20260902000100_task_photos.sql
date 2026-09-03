-- Supabase Storageへ保存するタスク写真の最小メタデータを追加する。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-photos', 'task-photos', false, 3145728, array['image/jpeg']::text[])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table public.task_photos (
  photo_id uuid primary key,
  task_id uuid not null references public.tasks(task_id) on delete cascade,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint chk_task_photos_sort_order check (sort_order >= 0)
);

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

-- Browserからの標準uploadは、未完了タスクの所定パスだけを許可する。
create policy task_photos_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-photos'
  and name ~ '^tasks/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$'
  and exists (
    select 1
    from public.tasks t
    join public.users u on u.user_id = (select auth.uid())
    where t.task_id::text = split_part(storage.objects.name, '/', 2)
      and t.deleted is null
      and t.current_status <> 3
      and u.deleted is null
      and u.role in (0, 1, 2)
  )
);

-- 有効な写真だけ、authenticatedユーザーが取得・signed URL発行できる。
create policy task_photos_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-photos'
  and exists (
    select 1
    from public.task_photos tp
    join public.tasks t on t.task_id = tp.task_id
    where storage.objects.name = 'tasks/' || tp.task_id::text || '/' || tp.photo_id::text || '.jpg'
      and tp.deleted_at is null
      and t.deleted is null
  )
);
