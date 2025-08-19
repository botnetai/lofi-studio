-- db/migrations/0001_init.sql
-- Initial schema + policies (ordered for clean creation on fresh DB)

-- ===== Schema =====
create extension if not exists pgcrypto;

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

create table if not exists public.space_messages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

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

alter table public.spaces drop constraint if exists spaces_single_background_chk;
alter table public.spaces
  add constraint spaces_single_background_chk
  check (not (background_artwork_id is not null and background_video_id is not null));

create index if not exists idx_artwork_user_created on public.artwork(user_id, created_at desc);
create index if not exists idx_videos_user_created on public.videos(user_id, created_at desc);
create index if not exists idx_spaces_user_created on public.spaces(user_id, created_at desc);
create index if not exists idx_songs_user_created on public.songs(user_id, created_at desc);
create index if not exists idx_songs_space_pos on public.songs(space_id, position);
create unique index if not exists uidx_songs_space_position on public.songs(space_id, position);
create index if not exists idx_space_messages_space_created on public.space_messages(space_id, created_at desc);

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

-- ===== RLS & Policies =====
alter table public.spaces enable row level security;
alter table public.songs enable row level security;
alter table public.artwork enable row level security;
alter table public.videos enable row level security;
alter table public.space_messages enable row level security;
alter table public.user_subscriptions enable row level security;

drop policy if exists spaces_select_public_or_own on public.spaces;
drop policy if exists spaces_modify_own on public.spaces;
drop policy if exists songs_select_own_or_public_space on public.songs;
drop policy if exists songs_modify_own on public.songs;
drop policy if exists artwork_select_own on public.artwork;
drop policy if exists artwork_modify_own on public.artwork;
drop policy if exists videos_select_own on public.videos;
drop policy if exists videos_modify_own on public.videos;
drop policy if exists space_messages_select_public_or_own on public.space_messages;
drop policy if exists space_messages_insert_own_space on public.space_messages;
drop policy if exists space_messages_delete_own on public.space_messages;
drop policy if exists user_subscriptions_own on public.user_subscriptions;

create policy spaces_select_public_or_own on public.spaces
  for select using (visibility = 'public' or user_id = auth.uid());

create policy spaces_modify_own on public.spaces
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy songs_select_own_or_public_space on public.songs
  for select using (
    user_id = auth.uid() or exists (
      select 1 from public.spaces s
      where s.id = songs.space_id and s.visibility = 'public'
    )
  );

create policy songs_modify_own on public.songs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy artwork_select_own on public.artwork
  for select using (user_id = auth.uid());

create policy artwork_modify_own on public.artwork
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy videos_select_own on public.videos
  for select using (user_id = auth.uid());

create policy videos_modify_own on public.videos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy space_messages_select_public_or_own on public.space_messages
  for select using (
    exists (
      select 1 from public.spaces s
      where s.id = space_messages.space_id
        and (s.visibility = 'public' or s.user_id = auth.uid())
    )
  );

create policy space_messages_insert_own_space on public.space_messages
  for insert with check (
    exists (
      select 1 from public.spaces s
      where s.id = space_messages.space_id
        and s.user_id = auth.uid()
    )
  );

create policy space_messages_delete_own on public.space_messages
  for delete using (user_id = auth.uid());

create policy user_subscriptions_own on public.user_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

