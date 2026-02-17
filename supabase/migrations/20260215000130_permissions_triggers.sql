-- 権限制御（更新内容制限）トリガ
-- Roles:
--   0 = Admin  : 全操作可（タスクの備考(note)編集もAdminのみ）
--   1 = Leader : タスクのステータス(current_status)変更のみ可（全タスク対象）
--   2 = User   : 参照のみ（tasksの更新は不可）

-- =========================================
-- users: 非Adminは name だけ更新可
-- =========================================
create or replace function public.enforce_users_update_permissions()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  -- 自分以外の更新は禁止
  if old.user_id <> auth.uid() then
    raise exception 'permission denied: cannot update other users';
  end if;

  -- 非Adminは name 以外の変更不可
  if (new.user_id, new.email, new.role, new.deleted, new.created, new.modified)
     is distinct from
     (old.user_id, old.email, old.role, old.deleted, old.created, old.modified) then
    raise exception 'permission denied: only name can be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_users_enforce_update_permissions on public.users;

create trigger trg_users_enforce_update_permissions
before update on public.users
for each row execute function public.enforce_users_update_permissions();

-- =========================================
-- tasks: Leaderは current_status だけ更新可（noteはAdminのみ）
-- =========================================
create or replace function public.enforce_tasks_update_permissions()
returns trigger
language plpgsql
as $$
declare
  r smallint;
begin
  r := public.user_role();

  if r = 0 then
    -- Admin: 何でもOK
    return new;
  elsif r = 1 then
    -- Leader: current_status だけ変更可（deleted や note 等は不可）
    if new.current_status is distinct from old.current_status then
      -- status以外が変わっていないことを保証
      if (new.task_id, new.created, new.modified,
          new.date_type, new.task_date, new.task_datetime,
          new.schedule_type, new.item_id, new.quantity,
          new.from_location_id, new.to_location_id,
          new.created_user_id, new.leader_user_id,
          new.note, new.deleted) is distinct from
         (old.task_id, old.created, old.modified,
          old.date_type, old.task_date, old.task_datetime,
          old.schedule_type, old.item_id, old.quantity,
          old.from_location_id, old.to_location_id,
          old.created_user_id, old.leader_user_id,
          old.note, old.deleted) then
        raise exception 'permission denied: leader can only change current_status';
      end if;

      return new;
    else
      raise exception 'permission denied: leader can only change current_status';
    end if;
  else
    -- User: 更新不可
    raise exception 'permission denied: tasks are read-only for this role';
  end if;
end;
$$;

drop trigger if exists trg_tasks_enforce_update_permissions on public.tasks;

create trigger trg_tasks_enforce_update_permissions
before update on public.tasks
for each row execute function public.enforce_tasks_update_permissions();

-- =========================================
-- tasks: ステータス変更を task_activities に記録
-- =========================================
create or replace function public.log_task_status_change()
returns trigger
language plpgsql
as $$
begin
  if new.current_status is distinct from old.current_status then
    insert into public.task_activities (
      task_id,
      changed_by_user_id,
      action,
      payload
    )
    values (
      new.task_id,
      auth.uid(),
      'status_change',
      jsonb_build_object(
        'from_status', old.current_status,
        'to_status', new.current_status
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tasks_log_status_change on public.tasks;

create trigger trg_tasks_log_status_change
after update of current_status on public.tasks
for each row execute function public.log_task_status_change();
