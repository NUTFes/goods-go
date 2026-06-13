create schema if not exists private authorization postgres;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create or replace function private.bootstrap_admin(target_email text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_email text;
  existing_admin_id uuid;
  target_user_id uuid;
begin
  normalized_email := lower(nullif(btrim(target_email), ''));
  if normalized_email is null then
    raise exception 'bootstrap admin email must not be blank';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('goods-go.bootstrap-admin', 0)
  );

  select user_id
  into existing_admin_id
  from public.users
  where role = 0
    and deleted is null
    and lower(btrim(email)) = normalized_email
  order by created, user_id
  limit 1;

  if existing_admin_id is not null then
    return existing_admin_id;
  end if;

  if exists (
    select 1
    from public.users
    where role = 0
      and deleted is null
  ) then
    raise exception 'an active administrator already exists';
  end if;

  select user_id
  into target_user_id
  from public.users
  where lower(btrim(email)) = normalized_email
    and deleted is null
  limit 1;

  if target_user_id is null then
    raise exception 'active user % does not exist', normalized_email;
  end if;

  update public.users
  set role = 0
  where user_id = target_user_id;
  return target_user_id;
end;
$$;

revoke all on function private.bootstrap_admin(text) from public;
revoke all on function private.bootstrap_admin(text) from anon, authenticated;
