-- ローカル開発専用のログインユーザー。

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
