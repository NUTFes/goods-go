-- 20260215000150_grants.sql
-- 入口（GRANT）を最小化。RLSとは別に超重要。
-- 方針: すべて authenticated 必須。anon は触らせない。

revoke all on all tables in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated, public;
revoke usage on schema public from anon, authenticated, public;

grant usage on schema public to authenticated;

-- users: 認証ユーザーは select/update だけ想定
grant select, update on table public.users to authenticated;

-- RLSで制御する前提で authenticated にCRUD
grant select, insert, update, delete on table public.items to authenticated;
grant select, insert, update, delete on table public.locations to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.task_activities to authenticated;

-- IDENTITY/SEQUENCE 採番に必要
grant usage, select on all sequences in schema public to authenticated;

-- 今後増えるテーブル/シーケンスにも同じ方針を適用
alter default privileges in schema public
grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
grant usage, select on sequences to authenticated;
