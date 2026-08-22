-- Local development shim. NEVER run this against Supabase.
--
-- Supabase gives every project three roles, an auth schema with auth.uid(), and an
-- extensions schema. A stock Postgres has none of them, so the real migrations would
-- fail locally for reasons that have nothing to do with whether they are correct.
--
-- This file creates just enough of that surface that supabase/migrations/*.sql run
-- unchanged on both. It is the only file with a local-only escape hatch in it, and
-- keeping the escape hatch here rather than sprinkling "if exists" through the real
-- migrations is the whole point: the migrations stay honest about their target.

create schema if not exists extensions;
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

-- auth.uid() reads the request JWT claims on Supabase. Locally we let a session set it
-- directly, which is exactly what the RLS tests need: switch role, set the uid, and see
-- what the policies actually allow.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;
