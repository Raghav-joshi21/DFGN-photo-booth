-- 0001_init.sql
-- Initial schema for the DFGN Photo Booth.
--
-- Apply with the Supabase CLI once your project exists:
--   supabase link --project-ref <ref>
--   supabase db push
-- or paste this file into the SQL editor in the Supabase dashboard.

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

alter table public.photos enable row level security;

-- Public (anon) read access to approved photos only — the booth wall.
create policy "approved photos are publicly readable"
  on public.photos
  for select
  using (status = 'approved');

-- Guest uploads: anyone may INSERT, but only as a 'pending' row. The WITH
-- CHECK forces status = 'pending', so a client can never self-approve.
create policy "guests can submit pending uploads"
  on public.photos
  for insert
  to anon, authenticated
  with check (status = 'pending');

-- NOTE: there are intentionally NO update/delete policies. With RLS enabled,
-- that means UPDATE and DELETE are denied for the anon/authenticated roles.
-- Only server-side code using the SERVICE-ROLE key (which bypasses RLS) may
-- change `status` (approve/reject) or set `edited_url`. This is what enforces
-- "only server-side code can update status".

-- Storage ------------------------------------------------------------------
-- Bucket that holds the raw uploaded/captured photos. Public so the booth wall
-- can render images by URL. (Public buckets are still write-protected by the
-- policies below.)

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Guests may upload into the 'photos' bucket.
create policy "guests can upload photos"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'photos');

-- Anyone may read from the 'photos' bucket.
create policy "photos bucket is publicly readable"
  on storage.objects
  for select
  using (bucket_id = 'photos');

-- Realtime -----------------------------------------------------------------
-- Let clients subscribe to changes so the booth wall updates live as photos
-- are inserted and as their status flips to 'approved'.
alter publication supabase_realtime add table public.photos;
