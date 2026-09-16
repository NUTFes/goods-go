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
	('音響機材一式'),
	('机'),
	('椅子'),
	('テント部品'),
	('パンフレット（箱）'),
	('技大50周年記念水（箱）')
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
	('116倉庫'),
	('B講義室前'),
	('休憩所（電気棟前）'),
	('フリマ'),
	('CAFE ECLA'),
	('木沢ハウス'),
	('調理場（電気棟）'),
	('案内所（情報処理センター前）'),
	('調理場（機械棟）'),
	('縁日'),
	('キッキングスナイパー'),
	('休憩所（機械棟前）'),
	('案内所（屋内プール前）'),
	('受付テント'),
	('音響'),
	('屋外ステージ'),
	('案内所（講義棟前）'),
	('財務物販テント'),
	('深才下宿貸間組合'),
	('新潟工科大学'),
	('休憩所（講義棟前）'),
	('休憩所（物材棟前）'),
	('謎解き（福利棟1階第一食堂沿い）'),
	('体育館内設営場所'),
	('長岡崇徳大学'),
	('物品管理用テント'),
	('電気院講義室')
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
			(1, 0, '机', 'B講義室前', '休憩所（電気棟前）', '09:00'::time, '10:00'::time, null::time, null::time, 25, 'チームB・フェーズ1／トラック行先：電気棟と物材経営情報棟の間'),
			(1, 0, '椅子', 'B講義室前', '休憩所（電気棟前）', '09:00'::time, '10:00'::time, null::time, null::time, 24, 'チームB・フェーズ1／トラック行先：電気棟と物材経営情報棟の間'),
			(1, 0, '机', 'B講義室前', 'フリマ', '09:00'::time, '10:00'::time, null::time, null::time, 11, 'チームB・フェーズ1／トラック行先：電気棟と物材経営情報棟の間'),
			(1, 0, '椅子', 'B講義室前', 'フリマ', '09:00'::time, '10:00'::time, null::time, null::time, 9, 'チームB・フェーズ1／トラック行先：電気棟と物材経営情報棟の間'),
			(1, 0, '机', 'B講義室前', 'CAFE ECLA', '09:00'::time, '10:00'::time, null::time, null::time, 1, 'チームB・フェーズ2／トラック行先：情報システムセンタと電気棟の間'),
			(1, 0, '椅子', 'B講義室前', 'CAFE ECLA', '09:00'::time, '10:00'::time, null::time, null::time, 3, 'チームB・フェーズ2／トラック行先：情報システムセンタと電気棟の間'),
			(1, 0, '机', 'B講義室前', '木沢ハウス', '09:00'::time, '10:00'::time, null::time, null::time, 2, 'チームB・フェーズ2／トラック行先：情報システムセンタと電気棟の間'),
			(1, 0, '椅子', 'B講義室前', '木沢ハウス', '09:00'::time, '10:00'::time, null::time, null::time, 2, 'チームB・フェーズ2／トラック行先：情報システムセンタと電気棟の間'),
			(1, 0, '机', 'B講義室前', '調理場（電気棟）', '09:00'::time, '10:00'::time, null::time, null::time, 4, 'チームB・フェーズ2／トラック行先：情報システムセンタと電気棟の間'),
			(1, 0, '椅子', 'B講義室前', '調理場（電気棟）', '09:00'::time, '10:00'::time, null::time, null::time, 5, 'チームB・フェーズ2／トラック行先：情報システムセンタと電気棟の間'),
			(1, 0, '机', 'B講義室前', '案内所（情報処理センター前）', '09:00'::time, '10:00'::time, null::time, null::time, 6, 'チームB・フェーズ2／トラック行先：情報システムセンタと電気棟の間'),
			(1, 0, '椅子', 'B講義室前', '案内所（情報処理センター前）', '09:00'::time, '10:00'::time, null::time, null::time, 3, 'チームB・フェーズ2／トラック行先：情報システムセンタと電気棟の間'),
			(1, 0, '机', 'B講義室前', '調理場（機械棟）', '09:00'::time, '10:00'::time, null::time, null::time, 4, 'チームB・フェーズ2／トラック行先：情報システムセンタと電気棟の間'),
			(1, 0, '椅子', 'B講義室前', '調理場（機械棟）', '09:00'::time, '10:00'::time, null::time, null::time, 5, 'チームB・フェーズ2／トラック行先：情報システムセンタと電気棟の間'),
			(1, 0, '机', 'B講義室前', '体育館', '09:00'::time, '10:00'::time, null::time, null::time, 20, 'チームB・フェーズ3／トラック行先：体育館裏口近く'),
			(1, 0, '椅子', 'B講義室前', '体育館', '09:00'::time, '10:00'::time, null::time, null::time, 20, 'チームB・フェーズ3／トラック行先：体育館裏口近く'),
			(1, 0, '机', 'B講義室前', '縁日', '09:00'::time, '10:00'::time, null::time, null::time, 14, 'チームB・フェーズ4／トラック行先：中央駐車場'),
			(1, 0, '椅子', 'B講義室前', '縁日', '09:00'::time, '10:00'::time, null::time, null::time, 7, 'チームB・フェーズ4／トラック行先：中央駐車場'),
			(1, 0, '机', 'B講義室前', 'キッキングスナイパー', '09:00'::time, '10:00'::time, null::time, null::time, 4, 'チームB・フェーズ4／トラック行先：中央駐車場'),
			(1, 0, '椅子', 'B講義室前', 'キッキングスナイパー', '09:00'::time, '10:00'::time, null::time, null::time, 4, 'チームB・フェーズ4／トラック行先：中央駐車場'),
			(1, 0, '机', 'B講義室前', '休憩所（機械棟前）', '09:00'::time, '10:00'::time, null::time, null::time, 25, 'チームB・フェーズ4／トラック行先：中央駐車場'),
			(1, 0, '椅子', 'B講義室前', '休憩所（機械棟前）', '09:00'::time, '10:00'::time, null::time, null::time, 24, 'チームB・フェーズ4／トラック行先：中央駐車場'),
			(1, 0, '机', 'B講義室前', '案内所（屋内プール前）', '09:00'::time, '10:00'::time, null::time, null::time, 6, 'チームB・フェーズ4／トラック行先：中央駐車場'),
			(1, 0, '椅子', 'B講義室前', '案内所（屋内プール前）', '09:00'::time, '10:00'::time, null::time, null::time, 3, 'チームB・フェーズ4／トラック行先：中央駐車場'),
			(1, 0, '机', 'B講義室前', '受付テント', '09:00'::time, '10:00'::time, null::time, null::time, 8, 'チームB・フェーズ4／トラック行先：中央駐車場'),
			(1, 0, '椅子', 'B講義室前', '受付テント', '09:00'::time, '10:00'::time, null::time, null::time, 5, 'チームB・フェーズ4／トラック行先：中央駐車場'),
			(1, 0, '机', 'B講義室前', '音響', '09:00'::time, '10:00'::time, null::time, null::time, 6, 'チームB・フェーズ4／トラック行先：中央駐車場'),
			(1, 0, '椅子', 'B講義室前', '音響', '09:00'::time, '10:00'::time, null::time, null::time, 8, 'チームB・フェーズ4／トラック行先：中央駐車場'),
			(1, 0, '机', 'B講義室前', '屋外ステージ', '09:00'::time, '10:00'::time, null::time, null::time, 20, 'チームB・フェーズ4／トラック行先：中央駐車場'),
			(1, 0, '椅子', 'B講義室前', '屋外ステージ', '09:00'::time, '10:00'::time, null::time, null::time, 20, 'チームB・フェーズ4／トラック行先：中央駐車場'),
			(1, 0, '掲示板', '体育館', '案内所（講義棟前）', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・トラック運搬／トラック行先：講義棟前'),
			(1, 0, 'パーティション', '体育館', '財務物販テント', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・トラック運搬／トラック行先：講義棟前'),
			(1, 0, '長机', '体育館', '深才下宿貸間組合', '10:00'::time, '12:00'::time, null::time, null::time, 6, 'チームB・トラック運搬／トラック行先：講義棟前'),
			(1, 0, 'パーティション', '体育館', '深才下宿貸間組合', '10:00'::time, '12:00'::time, null::time, null::time, 2, 'チームB・トラック運搬／トラック行先：講義棟前'),
			(1, 0, '長机', '体育館', '新潟工科大学', '10:00'::time, '12:00'::time, null::time, null::time, 4, 'チームB・トラック運搬／トラック行先：講義棟前'),
			(1, 0, 'テント部品', '体育館', '休憩所（講義棟前）', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・トラック運搬／トラック行先：講義棟前／テント番号：A-1'),
			(1, 0, 'テント部品', '体育館', '休憩所（物材棟前）', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・トラック運搬／トラック行先：講義棟前／テント番号：A-2'),
			(1, 0, 'テント部品', '体育館', '案内所（講義棟前）', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・トラック運搬／トラック行先：講義棟前／テント番号：46'),
			(1, 0, 'テント部品', '体育館', '財務物販テント', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・トラック運搬／トラック行先：講義棟前／テント番号：44'),
			(1, 0, 'パーティション', '体育館', 'フリマ', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・徒歩搬出'),
			(1, 0, '長机', '体育館', '木沢ハウス', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・徒歩搬出'),
			(1, 0, '掲示板', '体育館', '案内所（情報処理センター前）', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・徒歩搬出'),
			(1, 0, '長机', '体育館', 'CAFE ECLA', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・徒歩搬出'),
			(1, 0, 'パーティション', '体育館', '謎解き（福利棟1階第一食堂沿い）', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・徒歩搬出'),
			(1, 0, '長机', '体育館', '体育館内設営場所', '10:00'::time, '12:00'::time, null::time, null::time, 12, 'チームB・徒歩搬出'),
			(1, 0, 'パーティション', '体育館', '体育館内設営場所', '10:00'::time, '12:00'::time, null::time, null::time, 16, 'チームB・徒歩搬出'),
			(1, 0, '掲示板', '体育館', '案内所（屋内プール前）', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・徒歩搬出'),
			(1, 0, '長机', '体育館', '屋外ステージ', '10:00'::time, '12:00'::time, null::time, null::time, 2, 'チームB・徒歩搬出'),
			(1, 0, 'パーティション', '体育館', '長岡崇徳大学', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・徒歩搬出'),
			(1, 0, 'テント部品', '体育館', '休憩所（電気棟前）', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・徒歩搬出／テント番号：A-3'),
			(1, 0, 'テント部品', '体育館', '休憩所（機械棟前）', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・徒歩搬出／テント番号：A-4'),
			(1, 0, 'テント部品', '体育館', '案内所（屋内プール前）', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・徒歩搬出／テント番号：47'),
			(1, 0, 'テント部品', '体育館', '案内所（情報処理センター前）', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・徒歩搬出／テント番号：48'),
			(1, 0, 'テント部品', '体育館', '受付テント', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・徒歩搬出／テント番号：45'),
			(1, 0, 'テント部品', '体育館', '縁日', '10:00'::time, '12:00'::time, null::time, null::time, 5, 'チームB・徒歩搬出／テント番号：A、B、C、D、E'),
			(1, 0, 'テント部品', '体育館', 'キッキングスナイパー', '10:00'::time, '12:00'::time, null::time, null::time, 2, 'チームB・徒歩搬出／テント番号：高専2、高専3'),
			(1, 0, 'テント部品', '体育館', '物品管理用テント', '10:00'::time, '12:00'::time, null::time, null::time, 1, 'チームB・徒歩搬出／テント番号：A-5'),
			(1, 0, 'パンフレット（箱）', '電気院講義室', '案内所（講義棟前）', '13:00'::time, '14:00'::time, null::time, null::time, 2, '案内所設営'),
			(1, 0, 'パンフレット（箱）', '電気院講義室', '案内所（屋内プール前）', '13:00'::time, '14:00'::time, null::time, null::time, 2, '案内所設営'),
			(1, 0, 'パンフレット（箱）', '電気院講義室', '案内所（情報処理センター前）', '13:00'::time, '14:00'::time, null::time, null::time, 2, '案内所設営'),
			(1, 0, '技大50周年記念水（箱）', '電気院講義室', '案内所（屋内プール前）', '13:00'::time, '14:00'::time, null::time, null::time, 13, '案内所設営'),
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
