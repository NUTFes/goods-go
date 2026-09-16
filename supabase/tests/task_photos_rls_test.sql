begin;

select plan(10);

insert into public.items (item_id, name)
values ('42000000-0000-4000-8000-000000000001', '写真RLSテスト用物品');

insert into public.locations (location_id, name)
values
  ('42000000-0000-4000-8000-000000000101', '写真RLSテスト用搬出元'),
  ('42000000-0000-4000-8000-000000000102', '写真RLSテスト用搬出先');

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
  ('42000000-0000-4000-8000-000000000201', 0, '42000000-0000-4000-8000-000000000001', 1, '42000000-0000-4000-8000-000000000101', '42000000-0000-4000-8000-000000000102', '09:00', '10:00', '10000000-0000-0000-0000-0000000000a0', '10000000-0000-0000-0000-0000000000b0', 0, 'seed-task-01'),
  ('42000000-0000-4000-8000-000000000203', 0, '42000000-0000-4000-8000-000000000001', 1, '42000000-0000-4000-8000-000000000101', '42000000-0000-4000-8000-000000000102', '11:00', '12:00', '10000000-0000-0000-0000-0000000000a0', '10000000-0000-0000-0000-0000000000b0', 3, 'seed-task-03');

insert into public.task_photos (photo_id, task_id, sort_order)
select
  '20000000-0000-4000-8000-000000000001',
  task_id,
  0
from public.tasks
where note = 'seed-task-01';

insert into public.task_photos (photo_id, task_id, sort_order, deleted_at)
select
  '20000000-0000-4000-8000-000000000002',
  task_id,
  1,
  now()
from public.tasks
where note = 'seed-task-01';

insert into storage.objects (bucket_id, name)
select
  'task-photos',
  'tasks/' || task_id::text || '/20000000-0000-4000-8000-000000000001.jpg'
from public.tasks
where note = 'seed-task-01';

insert into storage.objects (bucket_id, name)
select
  'task-photos',
  'tasks/' || task_id::text || '/20000000-0000-4000-8000-000000000002.jpg'
from public.tasks
where note = 'seed-task-01';

select throws_ok(
  $$
    insert into public.task_photos (photo_id, task_id, sort_order)
    select
      '20000000-0000-4000-8000-000000000003',
      task_id,
      0
    from public.tasks
    where note = 'seed-task-01'
  $$,
  '23505',
  null,
  '有効写真の登録順重複を拒否する'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000c0', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select results_eq(
  $$select photo_id from public.task_photos order by sort_order$$,
  $$values ('20000000-0000-4000-8000-000000000001'::uuid)$$,
  'authenticatedは有効写真だけ参照できる'
);

select throws_ok(
  $$
    insert into public.task_photos (photo_id, task_id, sort_order)
    select
      '20000000-0000-4000-8000-000000000004',
      task_id,
      2
    from public.tasks
    where note = 'seed-task-01'
  $$,
  '42501',
  null,
  'authenticatedはtask_photosへ直接追加できない'
);

select throws_ok(
  $$update public.task_photos set deleted_at = now() where photo_id = '20000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'authenticatedはtask_photosを直接更新できない'
);

select lives_ok(
  $$
    insert into storage.objects (bucket_id, name)
    select
      'task-photos',
      'tasks/' || task_id::text || '/20000000-0000-4000-8000-000000000005.jpg'
    from public.tasks
    where note = 'seed-task-01'
  $$,
  'authenticatedは未完了タスクの所定パスへuploadできる'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name)
    select
      'task-photos',
      'tasks/' || task_id::text || '/20000000-0000-4000-8000-000000000006.jpg'
    from public.tasks
    where note = 'seed-task-03'
  $$,
  '42501',
  null,
  '完了タスクへのuploadを拒否する'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('task-photos', 'invalid.jpg')$$,
  '42501',
  null,
  '所定外のObject keyを拒否する'
);

select results_eq(
  $$select name from storage.objects where bucket_id = 'task-photos' order by name$$,
  $$
    select 'tasks/' || task_id::text || '/20000000-0000-4000-8000-000000000001.jpg'
    from public.tasks
    where note = 'seed-task-01'
  $$,
  '有効なtask_photosに対応するObjectだけ参照できる'
);

reset role;
set local role anon;

select throws_ok(
  $$select photo_id from public.task_photos$$,
  '42501',
  null,
  'anonは写真メタデータを参照できない'
);

select results_eq(
  $$select count(*)::bigint from storage.objects where bucket_id = 'task-photos'$$,
  array[0::bigint],
  'anonは写真Objectを参照できない'
);

select * from finish();
rollback;
