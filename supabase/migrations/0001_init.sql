-- 0001_init.sql
-- Initial schema for the DFGN Photo Booth.
--
-- Apply with the Supabase CLI:
--   supabase db push
-- or paste into the SQL editor in the Supabase dashboard.

-- Enums --------------------------------------------------------------------

-- Where a photo entered the system.
create type photo_source as enum ('booth', 'upload');

-- Moderation lifecycle. A photo is only shown on the wall once 'approved'.
create type photo_status as enum ('pending', 'approved', 'rejected');

-- Tables -------------------------------------------------------------------

create table if not exists public.photos (
  id            uuid primary key default gen_random_uuid(),
  source        photo_source not null,
  original_url  text not null,
  edited_url    text,
  status        photo_status not null default 'pending',
  created_at    timestamptz not null default now()
);

-- The booth wall queries approved photos newest-first; index for that path.
create index if not exists photos_status_created_at_idx
  on public.photos (status, created_at desc);

-- Row Level Security -------------------------------------------------------
-- Enabled by default so nothing is world-writable. The booth reads approved
-- photos with the anon key; writes/moderation go through server routes using
-- the service-role key (which bypasses RLS). Tighten these policies to match
-- your auth model before going live.

alter table public.photos enable row level security;

-- Public (anon) read access to approved photos only — this is what the booth
-- wall subscribes to.
create policy "approved photos are publicly readable"
  on public.photos
  for select
  using (status = 'approved');

-- Realtime -----------------------------------------------------------------
-- Let clients subscribe to changes (e.g. the booth wall updating live as
-- photos get approved).
alter publication supabase_realtime add table public.photos;
