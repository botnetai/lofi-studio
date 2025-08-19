-- db/policies.sql
-- Enable RLS and define policies (drop/create for idempotency)

-- Enable RLS
alter table public.spaces enable row level security;
alter table public.songs enable row level security;
alter table public.artwork enable row level security;
alter table public.videos enable row level security;
alter table public.space_messages enable row level security;
alter table public.user_subscriptions enable row level security;

-- Drop existing policies (safe if none exist)
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

-- Create policies
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

-- Owner-only posting (MVP)
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

