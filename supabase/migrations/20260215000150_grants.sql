-- Grants（RLSが有効なため、権限は最低限+RLSで制御）
-- Supabaseでは通常、authenticated ロールでアクセス

-- いったんクリア
revoke all on schema public from authenticated;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;
revoke all on all functions in schema public from authenticated;

-- スキーマ利用
grant usage on schema public to authenticated;

-- テーブル権限（RLSが最終防衛線）
grant select, update on table public.users to authenticated;

grant select, insert, update, delete on table public.items to authenticated;
grant select, insert, update, delete on table public.locations to authenticated;

grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert on table public.task_activities to authenticated;

-- シーケンス（identityがある場合）
grant usage, select on all sequences in schema public to authenticated;

-- 関数
grant execute on all functions in schema public to authenticated;
