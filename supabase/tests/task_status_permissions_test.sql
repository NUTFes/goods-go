begin;

select plan(12);

insert into public.items (item_id, name)
values ('43000000-0000-4000-8000-000000000001', 'ステータステスト用物品');

insert into public.locations (location_id, name)
values
  ('43000000-0000-4000-8000-000000000101', 'ステータステスト用搬出元'),
  ('43000000-0000-4000-8000-000000000102', 'ステータステスト用搬出先');

insert into public.tasks (
  task_id,
  event_day_type,
  item_id,
  quantity,
  from_location_id,
  to_location_id,
  scheduled_start_time,
  scheduled_end_time,
  created_user_id,
  leader_user_id,
  current_status,
  note
)
values
  ('43000000-0000-4000-8000-000000000201', 0, '43000000-0000-4000-8000-000000000001', 1, '43000000-0000-4000-8000-000000000101', '43000000-0000-4000-8000-000000000102', '09:00', '10:00', '10000000-0000-0000-0000-0000000000a0', '10000000-0000-0000-0000-0000000000b0', 0, 'test-task-01'),
  ('43000000-0000-4000-8000-000000000203', 0, '43000000-0000-4000-8000-000000000001', 1, '43000000-0000-4000-8000-000000000101', '43000000-0000-4000-8000-000000000102', '11:00', '12:00', '10000000-0000-0000-0000-0000000000a0', '10000000-0000-0000-0000-0000000000b0', 3, 'test-task-03'),
  ('43000000-0000-4000-8000-000000000204', 1, '43000000-0000-4000-8000-000000000001', 1, '43000000-0000-4000-8000-000000000101', '43000000-0000-4000-8000-000000000102', '12:00', '13:00', '10000000-0000-0000-0000-0000000000a0', '10000000-0000-0000-0000-0000000000b0', 0, 'test-task-04'),
  ('43000000-0000-4000-8000-000000000205', 1, '43000000-0000-4000-8000-000000000001', 1, '43000000-0000-4000-8000-000000000101', '43000000-0000-4000-8000-000000000102', '13:00', '14:00', '10000000-0000-0000-0000-0000000000a0', '10000000-0000-0000-0000-0000000000b0', 1, 'test-task-05'),
  ('43000000-0000-4000-8000-000000000206', 1, '43000000-0000-4000-8000-000000000001', 1, '43000000-0000-4000-8000-000000000101', '43000000-0000-4000-8000-000000000102', '14:00', '15:00', '10000000-0000-0000-0000-0000000000a0', '10000000-0000-0000-0000-0000000000b0', 2, 'test-task-06');

select is(
  (select current_status from public.tasks where note = 'test-task-03'),
  3::smallint,
  '従来の完了データは3=完了として扱う'
);
select is(
  (select current_status from public.tasks where note = 'test-task-06'),
  2::smallint,
  '2=確認中のデータを保持できる'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b0', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$update public.tasks set current_status = 1 where note = 'test-task-01'$$,
  'Leaderは未着手から進行中へ変更できる'
);
select lives_ok(
  $$update public.tasks set current_status = 2 where note = 'test-task-01'$$,
  'Leaderは進行中から確認中へ変更できる'
);
select throws_ok(
  $$update public.tasks set current_status = 3 where note = 'test-task-01'$$,
  'P0001',
  'permission denied: only admin can complete or reopen a task',
  'Leaderはタスクを完了にできない'
);
select throws_ok(
  $$update public.tasks set current_status = 0 where note = 'test-task-03'$$,
  'P0001',
  'permission denied: only admin can complete or reopen a task',
  'Leaderは完了したタスクを差し戻せない'
);
select throws_ok(
  $$update public.tasks set note = 'leader-edit' where note = 'test-task-05'$$,
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
      where note = 'test-task-04'
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
  $$update public.tasks set current_status = 3 where note = 'test-task-06'$$,
  'Adminは確認中から完了へ変更できる'
);
select lives_ok(
  $$update public.tasks set current_status = 1 where note = 'test-task-06'$$,
  'Adminは完了したタスクを差し戻せる'
);
select ok(
  exists (
    select 1
    from public.task_activities
    where task_id = (select task_id from public.tasks where note = 'test-task-01')
      and changed_by_user_id = '10000000-0000-0000-0000-0000000000b0'
      and action = 'status_change'
      and payload @> '{"from_status": 1, "to_status": 2}'::jsonb
  ),
  'ステータス変更者と遷移内容を監査ログへ保存する'
);
select throws_ok(
  $$update public.tasks set current_status = 4 where note = 'test-task-04'$$,
  '23514',
  'new row for relation "tasks" violates check constraint "chk_tasks_status"',
  '4状態以外はDB制約で拒否する'
);

select * from finish();
rollback;
