begin;

select plan(21);

select has_table('public', 'task_photos', 'task_photosが存在する');
select has_column('public', 'task_photos', 'photo_id', 'photo_idが存在する');
select has_column('public', 'task_photos', 'task_id', 'task_idが存在する');
select has_column('public', 'task_photos', 'sort_order', 'sort_orderが存在する');
select has_column('public', 'task_photos', 'width', 'widthが存在する');
select has_column('public', 'task_photos', 'height', 'heightが存在する');
select has_column('public', 'task_photos', 'created_by_user_id', 'created_by_user_idが存在する');
select has_column('public', 'task_photos', 'created_at', 'created_atが存在する');
select has_column('public', 'task_photos', 'deleted_by_user_id', 'deleted_by_user_idが存在する');
select has_column('public', 'task_photos', 'deleted_at', 'deleted_atが存在する');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.task_photos'::regclass),
  'task_photosでRLSが有効である'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.task_photos'::regclass),
  'task_photosでRLSが強制されている'
);

select throws_ok(
  $$
    insert into public.task_photos (
      photo_id, task_id, sort_order, width, height, created_by_user_id
    ) values (
      '20000000-0000-0000-0000-000000000001',
      (select task_id from public.tasks where note = 'seed-task-01'),
      0, 1921, 1080, '10000000-0000-0000-0000-0000000000c0'
    )
  $$,
  '23514',
  'new row for relation "task_photos" violates check constraint "chk_task_photos_dimensions"',
  '1920pxを超える幅を拒否する'
);

insert into public.task_photos (
  photo_id, task_id, sort_order, width, height, created_by_user_id
) values (
  '20000000-0000-0000-0000-000000000010',
  (select task_id from public.tasks where note = 'seed-task-01'),
  0, 1920, 1080, '10000000-0000-0000-0000-0000000000c0'
);

select throws_ok(
  $$
    insert into public.task_photos (
      photo_id, task_id, sort_order, width, height, created_by_user_id
    ) values (
      '20000000-0000-0000-0000-000000000011',
      (select task_id from public.tasks where note = 'seed-task-01'),
      0, 1280, 720, '10000000-0000-0000-0000-0000000000c0'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "uq_task_photos_active_sort_order"',
  '有効写真の登録順重複を拒否する'
);

insert into public.task_photos (
  photo_id, task_id, sort_order, width, height, created_by_user_id,
  deleted_by_user_id, deleted_at
) values (
  '20000000-0000-0000-0000-000000000012',
  (select task_id from public.tasks where note = 'seed-task-01'),
  0, 1280, 720, '10000000-0000-0000-0000-0000000000c0',
  '10000000-0000-0000-0000-0000000000a0', now()
);

select lives_ok(
  $$select photo_id from public.task_photos where photo_id = '20000000-0000-0000-0000-000000000012'$$,
  '論理削除済み写真は過去の登録順を保持できる'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000a0', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

update public.tasks
set deleted = now()
where note = 'seed-task-04';

reset role;

insert into public.task_photos (
  photo_id, task_id, sort_order, width, height, created_by_user_id
) values (
  '20000000-0000-0000-0000-000000000013',
  (select task_id from public.tasks where note = 'seed-task-04'),
  0, 1280, 720, '10000000-0000-0000-0000-0000000000c0'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000c0', true);
set local role authenticated;

select results_eq(
  $$select count(*)::bigint from public.task_photos$$,
  array[1::bigint],
  'Userは未削除タスクの有効写真だけ参照できる'
);

select throws_ok(
  $$
    insert into public.task_photos (
      photo_id, task_id, sort_order, width, height, created_by_user_id
    ) values (
      '20000000-0000-0000-0000-000000000014',
      (select task_id from public.tasks where note = 'seed-task-02'),
      0, 1280, 720, '10000000-0000-0000-0000-0000000000c0'
    )
  $$,
  '42501',
  'permission denied for table task_photos',
  'authenticatedから直接追加できない'
);
select throws_ok(
  $$update public.task_photos set width = 640 where photo_id = '20000000-0000-0000-0000-000000000010'$$,
  '42501',
  'permission denied for table task_photos',
  'authenticatedから直接更新できない'
);
select throws_ok(
  $$delete from public.task_photos where photo_id = '20000000-0000-0000-0000-000000000010'$$,
  '42501',
  'permission denied for table task_photos',
  'authenticatedから直接削除できない'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000a0', true);
set local role authenticated;

select results_eq(
  $$select count(*)::bigint from public.task_photos$$,
  array[1::bigint],
  'Adminでも論理削除写真と削除済みタスクの写真を参照できない'
);

reset role;
set local role anon;

select throws_ok(
  $$select photo_id from public.task_photos$$,
  '42501',
  'permission denied for table task_photos',
  'anonから写真を参照できない'
);

select * from finish();
rollback;
