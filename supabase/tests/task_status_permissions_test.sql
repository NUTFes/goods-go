begin;

select plan(20);

select has_column('public', 'tasks', 'lock_version', 'tasks.lock_versionが存在する');
select col_type_is('public', 'tasks', 'lock_version', 'bigint', 'lock_versionはbigintである');
select col_not_null('public', 'tasks', 'lock_version', 'lock_versionはNOT NULLである');
select col_default_is('public', 'tasks', 'lock_version', '0', 'lock_versionの初期値は0である');

select is(
  (select current_status from public.tasks where note = 'seed-task-03'),
  3::smallint,
  '従来の完了データは3=完了として扱う'
);
select is(
  (select current_status from public.tasks where note = 'seed-task-06'),
  2::smallint,
  '2=確認中のデータを保持できる'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b0', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$update public.tasks set current_status = 1 where note = 'seed-task-01'$$,
  'Leaderは未着手から進行中へ変更できる'
);
select is(
  (select lock_version from public.tasks where note = 'seed-task-01'),
  1::bigint,
  'タスク更新時にlock_versionが加算される'
);
select lives_ok(
  $$update public.tasks set current_status = 2 where note = 'seed-task-01'$$,
  'Leaderは進行中から確認中へ変更できる'
);
select throws_ok(
  $$update public.tasks set current_status = 3 where note = 'seed-task-01'$$,
  'P0001',
  'permission denied: only admin can complete or reopen a task',
  'Leaderはタスクを完了にできない'
);
select throws_ok(
  $$update public.tasks set current_status = 0 where note = 'seed-task-03'$$,
  'P0001',
  'permission denied: only admin can complete or reopen a task',
  'Leaderは完了したタスクを差し戻せない'
);
select throws_ok(
  $$update public.tasks set note = 'leader-edit' where note = 'seed-task-05'$$,
  'P0001',
  'permission denied: leader can only change current_status',
  'Leaderはステータス以外を変更できない'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000c0', true);
set local role authenticated;

select results_eq(
  $$
    with updated as (
      update public.tasks
      set current_status = 1
      where note = 'seed-task-04'
      returning task_id
    )
    select count(*)::bigint from updated
  $$,
  array[0::bigint],
  'Userのタスク更新はRLSで0件になる'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000a0', true);
set local role authenticated;

select lives_ok(
  $$update public.tasks set current_status = 3 where note = 'seed-task-06'$$,
  'Adminは確認中から完了へ変更できる'
);
select lives_ok(
  $$update public.tasks set current_status = 1 where note = 'seed-task-06'$$,
  'Adminは完了したタスクを差し戻せる'
);
select ok(
  exists (
    select 1
    from public.task_activities
    where task_id = (select task_id from public.tasks where note = 'seed-task-01')
      and changed_by_user_id = '10000000-0000-0000-0000-0000000000b0'
      and action = 'status_change'
      and payload @> '{"from_status": 1, "to_status": 2}'::jsonb
  ),
  'ステータス変更者と遷移内容を監査ログへ保存する'
);
select results_eq(
  $$
    with updated as (
      update public.tasks
      set current_status = 2
      where note = 'seed-task-02' and lock_version = 0
      returning task_id
    )
    select count(*)::bigint from updated
  $$,
  array[1::bigint],
  '一致するlock_versionでは更新できる'
);
select results_eq(
  $$
    with updated as (
      update public.tasks
      set current_status = 0
      where note = 'seed-task-02' and lock_version = 0
      returning task_id
    )
    select count(*)::bigint from updated
  $$,
  array[0::bigint],
  '古いlock_versionでは更新されない'
);
select throws_ok(
  $$update public.tasks set current_status = 4 where note = 'seed-task-04'$$,
  '23514',
  'new row for relation "tasks" violates check constraint "chk_tasks_status"',
  '4状態以外はDB制約で拒否する'
);
select throws_ok(
  $$update public.tasks set lock_version = 99 where note = 'seed-task-04'$$,
  'P0001',
  'lock_version is managed by the database',
  'lock_versionを直接変更できない'
);

select * from finish();
rollback;
