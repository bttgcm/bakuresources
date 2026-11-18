-- Run this once in the Supabase project's SQL editor (Database > SQL Editor).

create extension if not exists pgcrypto;

create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  category_id text not null,
  name text not null,
  lat double precision not null,
  lon double precision not null,
  description text,
  address text,
  url text,
  created_by uuid references auth.users(id) not null,
  created_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists venues_category_id_idx on venues (category_id);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  venue_ref text not null,
  body text not null,
  created_by uuid references auth.users(id) not null,
  created_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists comments_venue_ref_idx on comments (venue_ref);

alter table venues enable row level security;
alter table comments enable row level security;

create policy "Anyone can read venues"
  on venues for select
  using (true);

create policy "Authenticated users can add venues"
  on venues for insert
  with check (auth.uid() = created_by);

create policy "Authenticated users can read comments"
  on comments for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can add comments"
  on comments for insert
  with check (auth.uid() = created_by);

-- Tables created via the SQL editor (unlike the dashboard's table UI) don't
-- automatically grant table-level privileges to the authenticated role —
-- RLS policies alone aren't enough, Postgres checks base GRANTs first.
grant usage on schema public to authenticated, anon;
grant select, insert on public.venues to authenticated;
grant select on public.venues to anon;
grant select, insert on public.comments to authenticated;
