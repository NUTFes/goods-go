begin;

select plan(14);

select ok(
  has_function_privilege(
    'authenticated',
    'public.apply_task_photo_changes(uuid,uuid[],uuid[])',
    'execute'
  ),
  'authenticatedは写真変更RPCを実行できる'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.apply_task_photo_changes(uuid,uuid[],uuid[])',
    'execute'
  ),
  'anonは写真変更RPCを実行できない'
);

insert into storage.objects (bucket_id, name)
select
  'task-photos',
  'tasks/' || t.task_id::text || '/' || p.photo_id || '.jpg'
from public.tasks t
cross join (
  values
    ('30000000-0000-0000-0000-000000000001'),
    ('30000000-0000-0000-0000-000000000002')
) p(photo_id)
where t.note = 'seed-task-01';

insert into storage.objects (bucket_id, name)
select
  'task-photos',
  'tasks/' || t.task_id::text || '/' || p.photo_id || '.jpg'
from public.tasks t
cross join (
  values
    ('30000000-0000-0000-0000-000000000011'),
    ('30000000-0000-0000-0000-000000000012'),
    ('30000000-0000-0000-0000-000000000013'),
    ('30000000-0000-0000-0000-000000000014'),
    ('30000000-0000-0000-0000-000000000015'),
    ('30000000-0000-0000-0000-000000000016'),
    ('30000000-0000-0000-0000-000000000017'),
    ('30000000-0000-0000-0000-000000000018'),
    ('30000000-0000-0000-0000-000000000019')
) p(photo_id)
where t.note = 'seed-task-02';

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000c0', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.apply_task_photo_changes(
      (select task_id from public.tasks where note = 'seed-task-01'),
      array['30000000-0000-0000-0000-000000000001']::uuid[],
      array[]::uuid[]
    )
  $$,
  'Userは未完了タスクへ写真を追加できる'
);

select results_eq(
  $$
    select photo_id, sort_order
    from public.task_photos
    where photo_id = '30000000-0000-0000-0000-000000000001'
  $$,
  $$values ('30000000-0000-0000-0000-000000000001'::uuid, 0)$$,
  '追加写真を登録順0で保存する'
);

select public.apply_task_photo_changes(
  (select task_id from public.tasks where note = 'seed-task-01'),
  array['30000000-0000-0000-0000-000000000001']::uuid[],
  array[]::uuid[]
);

select results_eq(
  $$
    select
      (select count(*) from public.task_photos where photo_id = '30000000-0000-0000-0000-000000000001'),
      (select count(*) from public.task_activities where action = 'photo_added' and payload ->> 'photo_id' = '30000000-0000-0000-0000-000000000001')
  $$,
  $$values (1::bigint, 1::bigint)$$,
  '同一ID再送で写真と監査記録を重複させない'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b0', true);
set local role authenticated;

select lives_ok(
  $$
    select public.apply_task_photo_changes(
      (select task_id from public.tasks where note = 'seed-task-01'),
      array[]::uuid[],
      array['30000000-0000-0000-0000-000000000001']::uuid[]
    )
  $$,
  'Leaderも未完了タスクの写真を削除できる'
);

reset role;

select results_eq(
  $$
    select
      deleted_at is not null,
      (select count(*) from public.task_activities where action = 'photo_deleted' and payload ->> 'photo_id' = '30000000-0000-0000-0000-000000000001')
    from public.task_photos
    where photo_id = '30000000-0000-0000-0000-000000000001'
  $$,
  $$values (true, 1::bigint)$$,
  '削除状態と監査記録を保存する'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000a0', true);
set local role authenticated;

select public.apply_task_photo_changes(
  (select task_id from public.tasks where note = 'seed-task-01'),
  array['30000000-0000-0000-0000-000000000002']::uuid[],
  array[]::uuid[]
);

select results_eq(
  $$select sort_order from public.task_photos where photo_id = '30000000-0000-0000-0000-000000000002'$$,
  array[1],
  '論理削除済みの登録順を再利用しない'
);

select throws_ok(
  $$
    select public.apply_task_photo_changes(
      (select task_id from public.tasks where note = 'seed-task-02'),
      array['30000000-0000-0000-0000-000000000002']::uuid[],
      array[]::uuid[]
    )
  $$,
  'P0001',
  'photo_conflict',
  '別タスクの写真ID再利用を拒否する'
);

select throws_ok(
  $$
    select public.apply_task_photo_changes(
      (select task_id from public.tasks where note = 'seed-task-03'),
      array[]::uuid[],
      array[]::uuid[]
    )
  $$,
  'P0001',
  'task_completed',
  '完了タスクの写真変更を拒否する'
);

select public.apply_task_photo_changes(
  (select task_id from public.tasks where note = 'seed-task-02'),
  array[
    '30000000-0000-0000-0000-000000000011',
    '30000000-0000-0000-0000-000000000012',
    '30000000-0000-0000-0000-000000000013',
    '30000000-0000-0000-0000-000000000014',
    '30000000-0000-0000-0000-000000000015',
    '30000000-0000-0000-0000-000000000016',
    '30000000-0000-0000-0000-000000000017',
    '30000000-0000-0000-0000-000000000018'
  ]::uuid[],
  array[]::uuid[]
);

select results_eq(
  $$
    select array_agg(photo_id order by sort_order)
    from public.task_photos
    where task_id = (select task_id from public.tasks where note = 'seed-task-02')
      and deleted_at is null
  $$,
  $$
    values (array[
      '30000000-0000-0000-0000-000000000011'::uuid,
      '30000000-0000-0000-0000-000000000012'::uuid,
      '30000000-0000-0000-0000-000000000013'::uuid,
      '30000000-0000-0000-0000-000000000014'::uuid,
      '30000000-0000-0000-0000-000000000015'::uuid,
      '30000000-0000-0000-0000-000000000016'::uuid,
      '30000000-0000-0000-0000-000000000017'::uuid,
      '30000000-0000-0000-0000-000000000018'::uuid
    ])
  $$,
  '8枚をリクエスト順で保存する'
);

select throws_ok(
  $$
    select public.apply_task_photo_changes(
      (select task_id from public.tasks where note = 'seed-task-02'),
      array['30000000-0000-0000-0000-000000000019']::uuid[],
      array[]::uuid[]
    )
  $$,
  'P0001',
  'photo_limit_exceeded',
  '9枚目を拒否する'
);

select results_eq(
  $$select current_status from public.tasks where note = 'seed-task-02'$$,
  array[1::smallint],
  '写真操作でタスクのステータスを変更しない'
);

reset role;
set local role anon;

select throws_ok(
  $$
    select public.apply_task_photo_changes(
      (select task_id from public.tasks where note = 'seed-task-01'),
      array[]::uuid[],
      array[]::uuid[]
    )
  $$,
  '42501',
  null,
  'anonは写真変更RPCを実行できない'
);

select * from finish();
rollback;
