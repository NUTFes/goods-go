-- Authユーザー作成時に public.users（プロフィール/権限）を自動生成するトリガ
--  - role は 2(User) 固定（Admin/Leader はDB側で変更）
--  - name は raw_user_meta_data.name → emailの@前 → '（未設定）' の順に採用
--  - email が NULL/空の場合は NULL として保存（ユニーク制約は email IS NOT NULL の有効レコードのみ）

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_name  text;
begin
  v_email := nullif(btrim(new.email), '');

  v_name :=
    nullif(
      btrim(
        coalesce(new.raw_user_meta_data->>'name', '')
      ),
      ''
    );

  if v_name is null then
    if v_email is not null then
      v_name := split_part(v_email, '@', 1);
    else
      v_name := '（未設定）';
    end if;
  end if;

  insert into public.users (user_id, name, email, role)
  values (new.id, left(v_name, 60), v_email, 2)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();
