-- db/schema.sql
-- Single source of truth for core tables, indexes, triggers, constraints

-- Enable UUIDs
create extension if not exists pgcrypto;

-- 1) artwork (no FKs in)
create table if not exists public.artwork (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text,
  model text not null default 'fal-ai/flux-pro',
  request_id text,
  status text not null check (status in ('queued','generating','completed','failed')) default 'queued',
  r2_key text,
  r2_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 2) videos (FK to artwork)
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artwork_id uuid references public.artwork(id) on delete set null,
  prompt text,
  model text not null default 'fal-ai/kling-2.1',
  request_id text,
  status text not null check (status in ('queued','generating','completed','failed')) default 'queued',
  r2_key text,
  r2_url text,
  duration_seconds int,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 3) spaces (FKs to artwork/videos)
create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  visibility text not null check (visibility in ('private','public')) default 'private',
  chat_enabled boolean not null default false,
  description text,
  background_artwork_id uuid references public.artwork(id),
  background_video_id uuid references public.videos(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) songs (FK to spaces)
create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  position int not null,
  title text,
  prompt text,
  provider text not null default 'elevenlabs',
  generation_id text,
  status text not null check (status in ('queued','generating','completed','failed')) default 'queued',
  duration_seconds int,
  r2_key text,
  r2_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5) space_messages (FK to spaces)
create table if not exists public.space_messages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

-- 6) user_subscriptions
create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('free','pro')) default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce exactly one background on spaces (image XOR video)
alter table public.spaces drop constraint if exists spaces_single_background_chk;
alter table public.spaces
  add constraint spaces_single_background_chk
  check (not (background_artwork_id is not null and background_video_id is not null));

-- Indexes
create index if not exists idx_artwork_user_created on public.artwork(user_id, created_at desc);
create index if not exists idx_videos_user_created on public.videos(user_id, created_at desc);
create index if not exists idx_spaces_user_created on public.spaces(user_id, created_at desc);
create index if not exists idx_songs_user_created on public.songs(user_id, created_at desc);
create index if not exists idx_songs_space_pos on public.songs(space_id, position);
create unique index if not exists uidx_songs_space_position on public.songs(space_id, position);
create index if not exists idx_space_messages_space_created on public.space_messages(space_id, created_at desc);

-- updated_at trigger
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_songs_updated_at on public.songs;
create trigger trg_songs_updated_at before update on public.songs
for each row execute function public.set_updated_at();

drop trigger if exists trg_spaces_updated_at on public.spaces;
create trigger trg_spaces_updated_at before update on public.spaces
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_subs_updated_at on public.user_subscriptions;
create trigger trg_user_subs_updated_at before update on public.user_subscriptions
for each row execute function public.set_updated_at();

