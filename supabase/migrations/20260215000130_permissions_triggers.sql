-- 20260215000130_permissions_triggers.sql
-- 更新制御トリガ + タスク履歴トリガ

-- users更新制御（権限昇格防止）
-- - Admin: 全更新可
-- - 非Admin: 自分の name のみ更新可（email/role/deleted等は禁止）
create or replace function public.enforce_users_update_permissions()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if auth.uid() is null or old.user_id <> auth.uid() then
    raise exception 'permission denied';
  end if;

  if (new.user_id is distinct from old.user_id)
     or (new.email is distinct from old.email)
     or (new.role is distinct from old.role)
     or (new.deleted is distinct from old.deleted)
     or (new.created is distinct from old.created) then
    raise exception 'only name can be updated';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_users_enforce_update on public.users;
create trigger trg_users_enforce_update
before update on public.users
for each row execute function public.enforce_users_update_permissions();

-- tasks更新制御（列レベル権限相当をトリガで強制）
-- - Admin : 全更新可（note編集もAdminのみ）
-- - Leader: current_status のみ変更可（全タスク対象）
-- - User  : 更新不可
create or replace function public.enforce_tasks_update_permissions()
returns trigger
language plpgsql
as $$
declare
  r smallint;
begin
  r := public.user_role();
  if r is null then
    raise exception 'permission denied';
  end if;

  if r = 0 then
    return new; -- Admin
  end if;

  -- 変更禁止フィールド（modified は別トリガで変わるので比較対象から除外）
  if new.task_id is distinct from old.task_id
     or new.created is distinct from old.created then
    raise exception 'immutable fields changed';
  end if;

  if r = 1 then
    -- Leader: current_status 以外は変更禁止（note も禁止）
    if (new.current_status is distinct from old.current_status) then
      -- ok
    end if;

    if (new.date_type, new.leader_user_id, new.from_location_id, new.to_location_id, new.item_id,
        new.quantity, new.scheduled_start, new.scheduled_finish, new.note, new.deleted)
       is distinct from
       (old.date_type, old.leader_user_id, old.from_location_id, old.to_location_id, old.item_id,
        old.quantity, old.scheduled_start, old.scheduled_finish, old.note, old.deleted) then
      raise exception 'leader may only change current_status';
    end if;

    return new;
  end if;

  raise exception 'user is read-only for tasks';
end;
$$;

drop trigger if exists trg_tasks_enforce_update on public.tasks;
create trigger trg_tasks_enforce_update
before update on public.tasks
for each row execute function public.enforce_tasks_update_permissions();

-- タスクのステータス変更時に自動で履歴を追加
create or replace function public.log_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_status is distinct from old.current_status then
    insert into public.task_activities (task_id, status, operator_user_id, created)
    values (new.task_id, new.current_status, auth.uid(), now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_log_status on public.tasks;
create trigger trg_tasks_log_status
after update of current_status on public.tasks
for each row execute function public.log_task_status_change();
