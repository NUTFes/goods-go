-- Storageへupload済みの写真を、タスク単位の1トランザクションで確定する。

create or replace function public.apply_task_photo_changes(
  p_task_id uuid,
  p_add_photo_ids uuid[],
  p_delete_photo_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_task_status smallint;
  v_photo_id uuid;
  v_existing_task_id uuid;
  v_existing_deleted_at timestamptz;
  v_active_count integer;
  v_new_count integer := 0;
  v_next_sort_order integer;
begin
  if v_actor_user_id is null or not exists (
    select 1
    from public.users u
    where u.user_id = v_actor_user_id
      and u.deleted is null
      and u.role in (0, 1, 2)
  ) then
    raise exception using errcode = 'P0001', message = 'permission_denied';
  end if;

  select t.current_status
  into v_task_status
  from public.tasks t
  where t.task_id = p_task_id
    and t.deleted is null
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'task_not_found';
  end if;

  if v_task_status = 3 then
    raise exception using errcode = 'P0001', message = 'task_completed';
  end if;

  if p_add_photo_ids is null or p_delete_photo_ids is null
    or cardinality(p_add_photo_ids) > 8
    or cardinality(p_delete_photo_ids) > 8
    or exists (select 1 from unnest(p_add_photo_ids) id where id is null)
    or exists (select 1 from unnest(p_delete_photo_ids) id where id is null)
    or cardinality(p_add_photo_ids) <>
       (select count(distinct id) from unnest(p_add_photo_ids) id)
    or cardinality(p_delete_photo_ids) <>
       (select count(distinct id) from unnest(p_delete_photo_ids) id)
    or exists (
      select 1
      from unnest(p_add_photo_ids) addition_id
      join unnest(p_delete_photo_ids) deletion_id on deletion_id = addition_id
    ) then
    raise exception using errcode = 'P0001', message = 'invalid_request';
  end if;

  foreach v_photo_id in array p_add_photo_ids
  loop
    select tp.task_id, tp.deleted_at
    into v_existing_task_id, v_existing_deleted_at
    from public.task_photos tp
    where tp.photo_id = v_photo_id;

    if found then
      if v_existing_task_id <> p_task_id or v_existing_deleted_at is not null then
        raise exception using errcode = 'P0001', message = 'photo_conflict';
      end if;
      continue;
    end if;

    if not exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'task-photos'
        and o.name = 'tasks/' || p_task_id::text || '/' || v_photo_id::text || '.jpg'
    ) then
      raise exception using errcode = 'P0001', message = 'photo_not_found';
    end if;

    v_new_count := v_new_count + 1;
  end loop;

  foreach v_photo_id in array p_delete_photo_ids
  loop
    select tp.task_id
    into v_existing_task_id
    from public.task_photos tp
    where tp.photo_id = v_photo_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'photo_not_found';
    end if;

    if v_existing_task_id <> p_task_id then
      raise exception using errcode = 'P0001', message = 'photo_conflict';
    end if;
  end loop;

  for v_photo_id in
    update public.task_photos
    set deleted_at = now()
    where task_id = p_task_id
      and photo_id = any(p_delete_photo_ids)
      and deleted_at is null
    returning photo_id
  loop
    insert into public.task_activities (task_id, changed_by_user_id, action, payload)
    values (
      p_task_id,
      v_actor_user_id,
      'photo_deleted',
      jsonb_build_object('photo_id', v_photo_id)
    );
  end loop;

  select count(*)
  into v_active_count
  from public.task_photos tp
  where tp.task_id = p_task_id
    and tp.deleted_at is null;

  if v_active_count + v_new_count > 8 then
    raise exception using errcode = 'P0001', message = 'photo_limit_exceeded';
  end if;

  select coalesce(max(tp.sort_order), -1) + 1
  into v_next_sort_order
  from public.task_photos tp
  where tp.task_id = p_task_id;

  foreach v_photo_id in array p_add_photo_ids
  loop
    if exists (
      select 1
      from public.task_photos tp
      where tp.photo_id = v_photo_id
        and tp.task_id = p_task_id
        and tp.deleted_at is null
    ) then
      continue;
    end if;

    insert into public.task_photos (photo_id, task_id, sort_order)
    values (v_photo_id, p_task_id, v_next_sort_order);

    insert into public.task_activities (task_id, changed_by_user_id, action, payload)
    values (
      p_task_id,
      v_actor_user_id,
      'photo_added',
      jsonb_build_object('photo_id', v_photo_id, 'sort_order', v_next_sort_order)
    );

    v_next_sort_order := v_next_sort_order + 1;
  end loop;
end;
$$;

revoke execute on function public.apply_task_photo_changes(uuid, uuid[], uuid[]) from public;
revoke execute on function public.apply_task_photo_changes(uuid, uuid[], uuid[]) from anon;
grant execute on function public.apply_task_photo_changes(uuid, uuid[], uuid[]) to authenticated;
