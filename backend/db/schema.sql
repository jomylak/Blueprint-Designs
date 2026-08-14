-- Run this once in the Supabase project's SQL Editor to set up cloud-sync storage.

create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on projects(user_id);

-- The Flask backend connects with a direct/privileged Postgres role, so this RLS policy is
-- defense-in-depth (not the active enforcement - routes.py's user_id filtering is). Still
-- worth having in case this table is ever also exposed through Supabase's own client API.
alter table projects enable row level security;

create policy "individual access" on projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists projects_set_updated_at on projects;
create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();
