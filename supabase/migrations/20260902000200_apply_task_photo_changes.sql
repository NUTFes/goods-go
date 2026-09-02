-- タスク写真の追加・論理削除を、タスク単位の1トランザクションで確定する。
-- Storageへの書き込みはAPI側で先に完了し、この関数はDBを正として確定する。

create or replace function public.apply_task_photo_changes(
  p_task_id uuid,
  p_actor_user_id uuid,
  p_additions jsonb,
  p_delete_photo_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_actor_role smallint;
  v_task_status smallint;
  v_addition jsonb;
  v_photo_id uuid;
  v_width integer;
  v_height integer;
  v_existing_task_id uuid;
  v_existing_deleted_at timestamptz;
  v_seen_photo_ids uuid[] := array[]::uuid[];
  v_deleted_photo_id uuid;
  v_active_count integer;
  v_new_count integer := 0;
  v_next_sort_order integer;
begin
  select u.role
  into v_actor_role
  from public.users u
  where u.user_id = p_actor_user_id
    and u.deleted is null;

  if not found or v_actor_role not in (0, 1, 2) then
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

  if p_additions is null or jsonb_typeof(p_additions) <> 'array' or p_delete_photo_ids is null then
    raise exception using errcode = 'P0001', message = 'invalid_request';
  end if;

  if exists (select 1 from unnest(p_delete_photo_ids) id where id is null)
    or coalesce(array_length(p_delete_photo_ids, 1), 0) <>
       (select count(distinct id) from unnest(p_delete_photo_ids) id) then
    raise exception using errcode = 'P0001', message = 'invalid_request';
  end if;

  -- 追加分を先にすべて検証し、後続エラーで削除だけが残らないようにする。
  for v_addition in select value from jsonb_array_elements(p_additions)
  loop
    if jsonb_typeof(v_addition) <> 'object' then
      raise exception using errcode = 'P0001', message = 'invalid_request';
    end if;

    if not (v_addition ?& array['photo_id', 'width', 'height'])
      or exists (
        select 1
        from jsonb_object_keys(v_addition) key
        where key not in ('photo_id', 'width', 'height')
      ) then
      raise exception using errcode = 'P0001', message = 'invalid_request';
    end if;

    begin
      v_photo_id := (v_addition ->> 'photo_id')::uuid;
      v_width := (v_addition ->> 'width')::integer;
      v_height := (v_addition ->> 'height')::integer;
    exception when others then
      raise exception using errcode = 'P0001', message = 'invalid_request';
    end;

    if v_photo_id = any(v_seen_photo_ids)
      or v_width not between 1 and 1920
      or v_height not between 1 and 1920
      or v_width::bigint * v_height::bigint > 3686400 then
      raise exception using errcode = 'P0001', message = 'invalid_request';
    end if;

    if v_photo_id = any(p_delete_photo_ids) then
      raise exception using errcode = 'P0001', message = 'invalid_request';
    end if;

    v_seen_photo_ids := array_append(v_seen_photo_ids, v_photo_id);
    v_existing_task_id := null;
    v_existing_deleted_at := null;

    select tp.task_id, tp.deleted_at
    into v_existing_task_id, v_existing_deleted_at
    from public.task_photos tp
    where tp.photo_id = v_photo_id;

    if found then
      if v_existing_task_id <> p_task_id or v_existing_deleted_at is not null then
        raise exception using errcode = 'P0001', message = 'photo_conflict';
      end if;
      -- 同一タスクの有効な写真IDは再送として扱い、追加も監査記録もしない。
    else
      v_new_count := v_new_count + 1;
    end if;
  end loop;

  -- 削除対象は同じタスクに属することを確認する。論理削除済みの再送はno-opとする。
  foreach v_deleted_photo_id in array p_delete_photo_ids
  loop
    select tp.task_id
    into v_existing_task_id
    from public.task_photos tp
    where tp.photo_id = v_deleted_photo_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'photo_not_found';
    end if;

    if v_existing_task_id <> p_task_id then
      raise exception using errcode = 'P0001', message = 'photo_conflict';
    end if;
  end loop;

  for v_deleted_photo_id in
    update public.task_photos
    set deleted_by_user_id = p_actor_user_id,
        deleted_at = now()
    where task_id = p_task_id
      and photo_id = any(p_delete_photo_ids)
      and deleted_at is null
    returning photo_id
  loop
    insert into public.task_activities (
      task_id, changed_by_user_id, action, payload
    ) values (
      p_task_id,
      p_actor_user_id,
      'photo_deleted',
      jsonb_build_object('photo_id', v_deleted_photo_id)
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

  for v_addition in select value from jsonb_array_elements(p_additions)
  loop
    v_photo_id := (v_addition ->> 'photo_id')::uuid;

    if exists (
      select 1
      from public.task_photos tp
      where tp.photo_id = v_photo_id
        and tp.task_id = p_task_id
        and tp.deleted_at is null
    ) then
      continue;
    end if;

    v_width := (v_addition ->> 'width')::integer;
    v_height := (v_addition ->> 'height')::integer;

    begin
      insert into public.task_photos (
        photo_id, task_id, sort_order, width, height, created_by_user_id
      ) values (
        v_photo_id, p_task_id, v_next_sort_order, v_width, v_height, p_actor_user_id
      );
    exception when unique_violation then
      -- 別タスクで同じ写真IDが並行確定された場合も、内部エラーにせず競合として返す。
      raise exception using errcode = 'P0001', message = 'photo_conflict';
    end;

    insert into public.task_activities (
      task_id, changed_by_user_id, action, payload
    ) values (
      p_task_id,
      p_actor_user_id,
      'photo_added',
      jsonb_build_object('photo_id', v_photo_id, 'sort_order', v_next_sort_order)
    );

    v_next_sort_order := v_next_sort_order + 1;
  end loop;
end;
$$;

revoke execute on function public.apply_task_photo_changes(uuid, uuid, jsonb, uuid[]) from public;
revoke execute on function public.apply_task_photo_changes(uuid, uuid, jsonb, uuid[]) from anon;
revoke execute on function public.apply_task_photo_changes(uuid, uuid, jsonb, uuid[]) from authenticated;
grant execute on function public.apply_task_photo_changes(uuid, uuid, jsonb, uuid[]) to service_role;
