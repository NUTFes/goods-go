begin;

select plan(19);

select has_function(
  'public',
  'apply_task_photo_changes',
  array['uuid', 'uuid', 'jsonb', 'uuid[]'],
  '写真変更関数が存在する'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.apply_task_photo_changes(uuid,uuid,jsonb,uuid[])',
    'execute'
  ),
  'anonは写真変更関数を実行できない'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.apply_task_photo_changes(uuid,uuid,jsonb,uuid[])',
    'execute'
  ),
  'authenticatedは写真変更関数を実行できない'
);
select is_empty(
  $$
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid = 'public.apply_task_photo_changes(uuid,uuid,jsonb,uuid[])'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  $$,
  'PUBLICには写真変更関数の実行権限がない'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.apply_task_photo_changes(uuid,uuid,jsonb,uuid[])',
    'execute'
  ),
  'service_roleだけが写真変更関数を実行できる'
);

set local role service_role;

select lives_ok(
  $$
    select public.apply_task_photo_changes(
      (select task_id from public.tasks where note = 'seed-task-01'),
      '10000000-0000-0000-0000-0000000000c0',
      '[{"photo_id":"30000000-0000-0000-0000-000000000001","width":1920,"height":1080}]'::jsonb,
      array[]::uuid[]
    )
  $$,
  'Userも未完了タスクへ写真を追加できる'
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
select results_eq(
  $$
    select count(*)::bigint
    from public.task_activities
    where action = 'photo_added'
      and payload ->> 'photo_id' = '30000000-0000-0000-0000-000000000001'
  $$,
  array[1::bigint],
  '実際の写真追加だけ監査記録する'
);

select public.apply_task_photo_changes(
  (select task_id from public.tasks where note = 'seed-task-01'),
  '10000000-0000-0000-0000-0000000000c0',
  '[{"photo_id":"30000000-0000-0000-0000-000000000001","width":1280,"height":720}]'::jsonb,
  array[]::uuid[]
);
select results_eq(
  $$select count(*)::bigint from public.task_photos where photo_id = '30000000-0000-0000-0000-000000000001'$$,
  array[1::bigint],
  '同じ有効写真IDの再送は追加しない'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.task_activities
    where action = 'photo_added'
      and payload ->> 'photo_id' = '30000000-0000-0000-0000-000000000001'
  $$,
  array[1::bigint],
  '同じ有効写真IDの再送は監査記録を増やさない'
);

select public.apply_task_photo_changes(
  (select task_id from public.tasks where note = 'seed-task-01'),
  '10000000-0000-0000-0000-0000000000b0',
  '[]'::jsonb,
  array['30000000-0000-0000-0000-000000000001']::uuid[]
);
select results_eq(
  $$
    select deleted_by_user_id
    from public.task_photos
    where photo_id = '30000000-0000-0000-0000-000000000001'
  $$,
  $$values ('10000000-0000-0000-0000-0000000000b0'::uuid)$$,
  'Leaderも未完了タスクの写真を論理削除できる'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.task_activities
    where action = 'photo_deleted'
      and payload ->> 'photo_id' = '30000000-0000-0000-0000-000000000001'
  $$,
  array[1::bigint],
  '実際の写真削除だけ監査記録する'
);

select public.apply_task_photo_changes(
  (select task_id from public.tasks where note = 'seed-task-01'),
  '10000000-0000-0000-0000-0000000000b0',
  '[]'::jsonb,
  array['30000000-0000-0000-0000-000000000001']::uuid[]
);
select results_eq(
  $$
    select count(*)::bigint
    from public.task_activities
    where action = 'photo_deleted'
      and payload ->> 'photo_id' = '30000000-0000-0000-0000-000000000001'
  $$,
  array[1::bigint],
  '同じ削除の再送は監査記録を増やさない'
);

select public.apply_task_photo_changes(
  (select task_id from public.tasks where note = 'seed-task-01'),
  '10000000-0000-0000-0000-0000000000a0',
  '[{"photo_id":"30000000-0000-0000-0000-000000000002","width":1280,"height":720}]'::jsonb,
  array[]::uuid[]
);
select results_eq(
  $$select sort_order from public.task_photos where photo_id = '30000000-0000-0000-0000-000000000002'$$,
  array[1],
  '論理削除行を含む過去最大値の続きから採番する'
);

select throws_ok(
  $$
    select public.apply_task_photo_changes(
      (select task_id from public.tasks where note = 'seed-task-02'),
      '10000000-0000-0000-0000-0000000000a0',
      '[{"photo_id":"30000000-0000-0000-0000-000000000002","width":1280,"height":720}]'::jsonb,
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
      (select task_id from public.tasks where note = 'seed-task-01'),
      '10000000-0000-0000-0000-0000000000a0',
      '[{"photo_id":"30000000-0000-0000-0000-000000000001","width":1280,"height":720}]'::jsonb,
      array[]::uuid[]
    )
  $$,
  'P0001',
  'photo_conflict',
  '論理削除済み写真IDの再利用を拒否する'
);
select throws_ok(
  $$
    select public.apply_task_photo_changes(
      (select task_id from public.tasks where note = 'seed-task-03'),
      '10000000-0000-0000-0000-0000000000a0',
      '[{"photo_id":"30000000-0000-0000-0000-000000000003","width":1280,"height":720}]'::jsonb,
      array[]::uuid[]
    )
  $$,
  'P0001',
  'task_completed',
  '完了タスクの写真変更を拒否する'
);

select public.apply_task_photo_changes(
  (select task_id from public.tasks where note = 'seed-task-02'),
  '10000000-0000-0000-0000-0000000000a0',
  jsonb_build_array(
    jsonb_build_object('photo_id', '30000000-0000-0000-0000-000000000011', 'width', 640, 'height', 480),
    jsonb_build_object('photo_id', '30000000-0000-0000-0000-000000000012', 'width', 640, 'height', 480),
    jsonb_build_object('photo_id', '30000000-0000-0000-0000-000000000013', 'width', 640, 'height', 480),
    jsonb_build_object('photo_id', '30000000-0000-0000-0000-000000000014', 'width', 640, 'height', 480),
    jsonb_build_object('photo_id', '30000000-0000-0000-0000-000000000015', 'width', 640, 'height', 480),
    jsonb_build_object('photo_id', '30000000-0000-0000-0000-000000000016', 'width', 640, 'height', 480),
    jsonb_build_object('photo_id', '30000000-0000-0000-0000-000000000017', 'width', 640, 'height', 480),
    jsonb_build_object('photo_id', '30000000-0000-0000-0000-000000000018', 'width', 640, 'height', 480)
  ),
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
  '追加リクエスト順で8枚を採番する'
);
select throws_ok(
  $$
    select public.apply_task_photo_changes(
      (select task_id from public.tasks where note = 'seed-task-02'),
      '10000000-0000-0000-0000-0000000000a0',
      '[{"photo_id":"30000000-0000-0000-0000-000000000019","width":640,"height":480}]'::jsonb,
      array[]::uuid[]
    )
  $$,
  'P0001',
  'photo_limit_exceeded',
  '有効写真が8枚を超える変更を拒否する'
);

reset role;

select * from finish();
rollback;
