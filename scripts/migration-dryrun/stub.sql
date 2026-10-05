-- The minimum of Supabase that supabase/migrations/ touches, on plain Postgres.
-- auth.uid() reads the same JWT claim setting PostgREST sets, so RLS policies
-- compile; the dry run itself connects as a superuser and bypasses them.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text
);
create function auth.uid() returns uuid
language sql
stable
as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create schema storage;
create table storage.buckets (
    id text primary key,
    name text,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
);
create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text,
    name text,
    owner uuid
);
