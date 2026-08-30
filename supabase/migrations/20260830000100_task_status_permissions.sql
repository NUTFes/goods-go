-- タスクを4状態へ拡張し、状態遷移の権限と楽観ロックをDBで保証する。
-- Statuses: 0=未着手, 1=進行中, 2=確認中, 3=完了

-- 既存の 2=完了 を 3=完了へ移す間は、利用者操作ではないため監査ログを残さない。
drop trigger if exists trg_tasks_log_status_change on public.tasks;
-- 旧権限トリガーは認証文脈のないmigration更新を拒否するため、移行中だけ外す。
drop trigger if exists trg_tasks_enforce_update_permissions on public.tasks;

alter table public.tasks drop constraint if exists chk_tasks_status;

update public.tasks
set current_status = 3
where current_status = 2;

alter table public.tasks
  add constraint chk_tasks_status check (current_status in (0, 1, 2, 3)),
  add column lock_version bigint not null default 0;

comment on column public.tasks.current_status is '0=未着手, 1=進行中, 2=確認中, 3=完了';
comment on column public.tasks.lock_version is '楽観ロック用。タスク更新のたびにDBトリガーが加算する。';

-- Leaderは未完了のタスクを0〜2の範囲でのみ遷移できる。
-- 完了への変更と完了からの差し戻しはAdminだけが行える。
create or replace function public.enforce_tasks_update_permissions()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  r smallint;
begin
  r := public.user_role();

  if r = 0 then
    return new;
  elsif r = 1 then
    if new.current_status is not distinct from old.current_status then
      raise exception 'permission denied: leader can only change current_status';
    end if;

    if old.current_status = 3 or new.current_status = 3 then
      raise exception 'permission denied: only admin can complete or reopen a task';
    end if;

    if new.current_status not in (0, 1, 2) then
      raise exception 'permission denied: invalid leader status transition';
    end if;

    if (new.task_id, new.created, new.modified,
        new.event_day_type, new.item_id, new.quantity,
        new.from_location_id, new.to_location_id,
        new.scheduled_start_time, new.scheduled_end_time,
        new.actual_start_time, new.actual_end_time,
        new.created_user_id, new.leader_user_id,
        new.note, new.deleted, new.lock_version) is distinct from
       (old.task_id, old.created, old.modified,
        old.event_day_type, old.item_id, old.quantity,
        old.from_location_id, old.to_location_id,
        old.scheduled_start_time, old.scheduled_end_time,
        old.actual_start_time, old.actual_end_time,
        old.created_user_id, old.leader_user_id,
        old.note, old.deleted, old.lock_version) then
      raise exception 'permission denied: leader can only change current_status';
    end if;

    return new;
  else
    raise exception 'permission denied: tasks are read-only for this role';
  end if;
end;
$$;

create trigger trg_tasks_enforce_update_permissions
before update on public.tasks
for each row execute function public.enforce_tasks_update_permissions();

-- lock_versionはクライアントから直接変更させず、成功した更新ごとに加算する。
create or replace function public.increment_task_lock_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lock_version is distinct from old.lock_version then
    raise exception 'lock_version is managed by the database';
  end if;

  new.lock_version := old.lock_version + 1;
  return new;
end;
$$;

drop trigger if exists trg_tasks_set_lock_version on public.tasks;
create trigger trg_tasks_set_lock_version
before update on public.tasks
for each row execute function public.increment_task_lock_version();

-- 既存の監査関数を使い、4状態の変更も同じ形式で記録する。
create trigger trg_tasks_log_status_change
after update of current_status on public.tasks
for each row execute function public.log_task_status_change();
