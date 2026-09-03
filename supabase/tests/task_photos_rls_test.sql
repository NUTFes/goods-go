begin;

select plan(10);

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
