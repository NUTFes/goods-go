-- =========================================
-- Seed data for local development
-- =========================================

-- auth users
insert into auth.users (
	instance_id,
	id,
	aud,
	role,
	email,
	encrypted_password,
	email_confirmed_at,
	confirmation_token,
	recovery_token,
	email_change_token_new,
	email_change,
	raw_app_meta_data,
	raw_user_meta_data,
	created_at,
	updated_at
)
values
	('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-0000000000a0', 'authenticated', 'authenticated', 'admin@goods-go.local', extensions.crypt('gidaifes', extensions.gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"管理者 太郎"}'::jsonb, now(), now()),
	('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-0000000000b0', 'authenticated', 'authenticated', 'leader@goods-go.local', extensions.crypt('gidaifes', extensions.gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"指揮者 花子"}'::jsonb, now(), now()),
	('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-0000000000c0', 'authenticated', 'authenticated', 'user@goods-go.local', extensions.crypt('gidaifes', extensions.gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"一般 次郎"}'::jsonb, now(), now())
on conflict (id) do update
set
	instance_id = excluded.instance_id,
	email = excluded.email,
	encrypted_password = excluded.encrypted_password,
	email_confirmed_at = excluded.email_confirmed_at,
	raw_app_meta_data = excluded.raw_app_meta_data,
	raw_user_meta_data = excluded.raw_user_meta_data,
	updated_at = excluded.updated_at;

insert into auth.identities (
	provider_id,
	user_id,
	identity_data,
	provider,
	last_sign_in_at,
	created_at,
	updated_at
)
values
	('10000000-0000-0000-0000-0000000000a0', '10000000-0000-0000-0000-0000000000a0', '{"sub":"10000000-0000-0000-0000-0000000000a0","email":"admin@goods-go.local","email_verified":true,"phone_verified":false}'::jsonb, 'email', now(), now(), now()),
	('10000000-0000-0000-0000-0000000000b0', '10000000-0000-0000-0000-0000000000b0', '{"sub":"10000000-0000-0000-0000-0000000000b0","email":"leader@goods-go.local","email_verified":true,"phone_verified":false}'::jsonb, 'email', now(), now(), now()),
	('10000000-0000-0000-0000-0000000000c0', '10000000-0000-0000-0000-0000000000c0', '{"sub":"10000000-0000-0000-0000-0000000000c0","email":"user@goods-go.local","email_verified":true,"phone_verified":false}'::jsonb, 'email', now(), now(), now())
on conflict (provider_id, provider) do update
set
	user_id = excluded.user_id,
	identity_data = excluded.identity_data,
	updated_at = excluded.updated_at;

-- public users (override role)
insert into public.users (user_id, name, email, role)
values
	('10000000-0000-0000-0000-0000000000a0', '管理者 太郎', 'admin@goods-go.local', 0),
	('10000000-0000-0000-0000-0000000000b0', '指揮者 花子', 'leader@goods-go.local', 1),
	('10000000-0000-0000-0000-0000000000c0', '一般 次郎', 'user@goods-go.local', 2)
on conflict (user_id) do update
set
	name = excluded.name,
	email = excluded.email,
	role = excluded.role,
	deleted = null;

-- items
insert into public.items (name)
values
	('技大祭テント大'),
	('技大祭テント小'),
	('技大祭テント新'),
	('長岡高専テント'),
	('長岡大学テント'),
	('長机'),
	('パイロン'),
	('パーティション'),
	('パーティション足'),
	('掲示板'),
	('ゴミ箱大'),
	('ゴミ箱中'),
	('ゴミ箱小'),
	('音響機材一式')
on conflict do nothing;

-- locations
insert into public.locations (name)
values
	('体育館'),
	('グラウンド器具庫'),
	('長岡高専'),
	('長岡大学'),
	('24下倉庫'),
	('地域防災実践研究センター'),
	('116倉庫')
on conflict do nothing;

-- tasks
with
admin_user as (
	select user_id from public.users where email = 'admin@goods-go.local' and deleted is null limit 1
),
leader_user as (
	select user_id from public.users where email = 'leader@goods-go.local' and deleted is null limit 1
),
item_map as (
	select item_id, name from public.items where deleted is null
),
location_map as (
	select location_id, name from public.locations where deleted is null
),
seed_rows as (
	select *
	from (
		values
			(2, 0, '技大祭テント大', '体育館', 'グラウンド器具庫', '13:00'::time, '17:00'::time, null::time, null::time, 45, '軽トラックで運搬'),
			(2, 0, '技大祭テント小', '体育館', 'グラウンド器具庫', '13:00'::time, '17:00'::time, null::time, null::time, 5, '軽トラックで運搬'),
			(2, 0, '技大祭テント新', '体育館', 'グラウンド器具庫', '13:00'::time, '17:00'::time, null::time, null::time, 5, '軽トラックで運搬'),
			(2, 0, '長岡高専テント', '体育館', '長岡高専', '13:00'::time, '17:00'::time, null::time, null::time, 8, '軽トラックで運搬'),
			(2, 0, '長岡大学テント', '体育館', '長岡大学', '13:00'::time, '17:00'::time, null::time, null::time, 4, '軽トラックで運搬'),
			(2, 0, '長机', '体育館', '24下倉庫', '13:00'::time, '17:00'::time, null::time, null::time, 68, '軽トラックで運搬'),
			(2, 0, 'パイロン', '体育館', '24下倉庫', '13:00'::time, '17:00'::time, null::time, null::time, 103, '軽トラックで運搬'),
			(2, 0, 'パーティション', '体育館', '24下倉庫', '13:00'::time, '17:00'::time, null::time, null::time, 27, '軽トラックで運搬'),
			(2, 0, 'パーティション足', '体育館', '24下倉庫', '13:00'::time, '17:00'::time, null::time, null::time, 54, '軽トラックで運搬'),
			(2, 0, '掲示板', '体育館', '地域防災実践研究センター', '13:00'::time, '17:00'::time, null::time, null::time, 50, '支援課トラックで運搬'),
			(2, 0, 'ゴミ箱大', '体育館', '24下倉庫', '13:00'::time, '17:00'::time, null::time, null::time, 8, '軽トラックで運搬'),
			(2, 0, 'ゴミ箱中', '体育館', '24下倉庫', '13:00'::time, '17:00'::time, null::time, null::time, 8, '軽トラックで運搬'),
			(2, 0, 'ゴミ箱小', '体育館', '24下倉庫', '13:00'::time, '17:00'::time, null::time, null::time, 11, '軽トラックで運搬'),
			(2, 0, '音響機材一式', '体育館', '116倉庫', '13:00'::time, '17:00'::time, null::time, null::time, 1, '軽トラックで運搬')
	) as t(
		event_day_type,
		current_status,
		item_name,
		from_location_name,
		to_location_name,
		scheduled_start_time,
		scheduled_end_time,
		actual_start_time,
		actual_end_time,
		quantity,
		note
	)
)
insert into public.tasks (
	event_day_type,
	item_id,
	quantity,
	from_location_id,
	to_location_id,
	scheduled_start_time,
	scheduled_end_time,
	actual_start_time,
	actual_end_time,
	created_user_id,
	leader_user_id,
	current_status,
	note
)
select
	s.event_day_type,
	i.item_id,
	s.quantity,
	fl.location_id,
	tl.location_id,
	s.scheduled_start_time,
	s.scheduled_end_time,
	s.actual_start_time,
	s.actual_end_time,
	a.user_id,
	l.user_id,
	s.current_status,
	s.note
from seed_rows s
join item_map i on i.name = s.item_name
join location_map fl on fl.name = s.from_location_name
join location_map tl on tl.name = s.to_location_name
cross join admin_user a
cross join leader_user l
where not exists (
	select 1
	from public.tasks t
	where t.event_day_type = s.event_day_type
		and t.item_id = i.item_id
		and t.from_location_id = fl.location_id
		and t.to_location_id = tl.location_id
		and t.scheduled_start_time = s.scheduled_start_time
		and t.scheduled_end_time = s.scheduled_end_time
		and t.deleted is null
);
