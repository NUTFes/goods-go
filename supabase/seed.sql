-- =========================================
-- Seed data for local development
-- =========================================

-- auth users
insert into auth.users (
	id,
	aud,
	role,
	email,
	raw_app_meta_data,
	raw_user_meta_data,
	created_at,
	updated_at
)
values
	('10000000-0000-0000-0000-0000000000a0', 'authenticated', 'authenticated', 'admin@goods-go.local', '{}'::jsonb, '{"name":"管理者 太郎"}'::jsonb, now(), now()),
	('10000000-0000-0000-0000-0000000000b0', 'authenticated', 'authenticated', 'leader@goods-go.local', '{}'::jsonb, '{"name":"指揮者 花子"}'::jsonb, now(), now()),
	('10000000-0000-0000-0000-0000000000c0', 'authenticated', 'authenticated', 'user@goods-go.local', '{}'::jsonb, '{"name":"一般 次郎"}'::jsonb, now(), now())
on conflict (id) do nothing;

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
	('椅子'),
	('机'),
	('テント'),
	('パネル'),
	('カラーコーン')
on conflict do nothing;

-- locations
insert into public.locations (name)
values
	('講義棟102'),
	('講義棟201'),
	('AL2'),
	('体育館前'),
	('正門広場')
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
			(0, 0, '椅子', '講義棟102', '講義棟201', '08:00'::time, '09:00'::time, null::time, null::time, 10, 'seed-task-01'),
			(0, 1, '机', 'AL2', '講義棟102', '09:00'::time, '10:00'::time, '09:10'::time, null::time, 8, 'seed-task-02'),
			(0, 2, 'テント', '体育館前', '正門広場', '10:00'::time, '11:30'::time, '10:00'::time, '11:20'::time, 4, 'seed-task-03'),
			(1, 0, 'パネル', '講義棟201', 'AL2', '08:30'::time, '09:30'::time, null::time, null::time, 6, 'seed-task-04'),
			(1, 1, '椅子', '正門広場', '体育館前', '09:30'::time, '10:30'::time, '09:40'::time, null::time, 20, 'seed-task-05'),
			(1, 2, 'カラーコーン', '講義棟102', '正門広場', '11:00'::time, '12:00'::time, '11:05'::time, '11:50'::time, 12, 'seed-task-06'),
			(2, 0, '机', '体育館前', '講義棟201', '13:00'::time, '14:00'::time, null::time, null::time, 5, 'seed-task-07'),
			(2, 1, 'テント', '正門広場', 'AL2', '14:00'::time, '15:30'::time, '14:05'::time, null::time, 3, 'seed-task-08'),
			(2, 2, '椅子', '講義棟201', '講義棟102', '15:30'::time, '16:30'::time, '15:40'::time, '16:20'::time, 15, 'seed-task-09'),
			(1, 0, 'パネル', 'AL2', '体育館前', '16:30'::time, '17:30'::time, null::time, null::time, 7, 'seed-task-10'),
			(0, 1, 'カラーコーン', '講義棟102', 'AL2', '17:30'::time, '18:00'::time, '17:40'::time, null::time, 9, 'seed-task-11'),
			(2, 2, '机', '講義棟201', '正門広場', '18:00'::time, '19:00'::time, '18:05'::time, '18:50'::time, 4, 'seed-task-12')
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
	where t.note = s.note
		and t.deleted is null
);
