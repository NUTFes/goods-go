-- 20260215000110_auth_user_trigger.sql
-- auth.users 作成時に public.users を自動作成（全員 User=2）

create or replace function public.handle_new_auth_user
()
returns trigger
language plpgsql
security definer
set search_path
= public
as $$
begin
    insert into public.users
        (user_id, name, email, role)
    values
        (
            new.id,
            coalesce(new.raw_user_meta_data->>'name', ''),
            coalesce(new.email, ''),
            2
  )
    on conflict
    (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created
on auth.users;
create trigger on_auth_user_created
after
insert on
auth.users
for each row
execute
function public.handle_new_auth_user
();
