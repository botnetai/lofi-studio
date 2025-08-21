-- Add SFX (Sound Effects) support for spaces
-- Allows layering ambient sounds over background music

-- SFX Effects catalog
create table if not exists public.sfx_effects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_name text not null,
  category text not null check (category in ('nature', 'ambience', 'weather', 'urban', 'other')),
  description text,
  r2_key text not null, -- S3 key for the audio file in R2
  r2_url text not null, -- Public URL for the audio file
  duration_seconds int, -- Duration of the SFX loop
  default_gain decimal(3,2) not null default 0.3, -- Default volume (0.0 to 1.0)
  created_at timestamptz not null default now()
);

-- Space SFX selections (which effects are active for a space and their volumes)
create table if not exists public.space_sfx (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  sfx_effect_id uuid not null references public.sfx_effects(id) on delete cascade,
  gain decimal(3,2) not null default 0.3 check (gain >= 0.0 and gain <= 1.0), -- Volume level
  position int not null default 0, -- Order/priority of the effect
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(space_id, sfx_effect_id) -- Prevent duplicate effects per space
);

-- Indexes for performance
create index if not exists idx_sfx_effects_category on public.sfx_effects(category);
create index if not exists idx_space_sfx_space_id on public.space_sfx(space_id);
create index if not exists idx_space_sfx_effect_id on public.space_sfx(sfx_effect_id);

-- Updated at trigger for space_sfx
drop trigger if exists trg_space_sfx_updated_at on public.space_sfx;
create trigger trg_space_sfx_updated_at before update on public.space_sfx for each row execute function public.set_updated_at();

-- Seed initial SFX catalog with common ambient sounds
-- Note: These R2 keys should be uploaded to your R2 bucket
insert into public.sfx_effects (name, display_name, category, description, r2_key, r2_url, duration_seconds, default_gain) values
  ('rain_light', 'Light Rain', 'weather', 'Gentle rain falling on leaves', 'sfx/rain_light.mp3', 'https://your-r2-url/sfx/rain_light.mp3', 120, 0.4),
  ('rain_heavy', 'Heavy Rain', 'weather', 'Heavy rain with thunder in background', 'sfx/rain_heavy.mp3', 'https://your-r2-url/sfx/rain_heavy.mp3', 180, 0.5),
  ('forest_birds', 'Forest Birds', 'nature', 'Various bird calls in a forest', 'sfx/forest_birds.mp3', 'https://your-r2-url/sfx/forest_birds.mp3', 240, 0.3),
  ('ocean_waves', 'Ocean Waves', 'nature', 'Gentle ocean waves on beach', 'sfx/ocean_waves.mp3', 'https://your-r2-url/sfx/ocean_waves.mp3', 200, 0.4),
  ('wind_gentle', 'Gentle Wind', 'weather', 'Soft wind through trees', 'sfx/wind_gentle.mp3', 'https://your-r2-url/sfx/wind_gentle.mp3', 150, 0.2),
  ('crackling_fire', 'Crackling Fire', 'ambience', 'Cozy fireplace crackling', 'sfx/crackling_fire.mp3', 'https://your-r2-url/sfx/crackling_fire.mp3', 160, 0.6),
  ('cafe_ambience', 'Cafe Ambience', 'urban', 'Coffee shop background noise', 'sfx/cafe_ambience.mp3', 'https://your-r2-url/sfx/cafe_ambience.mp3', 300, 0.3),
  ('city_traffic', 'City Traffic', 'urban', 'Distant city traffic sounds', 'sfx/city_traffic.mp3', 'https://your-r2-url/sfx/city_traffic.mp3', 180, 0.2),
  ('thunder_storm', 'Thunder Storm', 'weather', 'Distant thunder and heavy rain', 'sfx/thunder_storm.mp3', 'https://your-r2-url/sfx/thunder_storm.mp3', 220, 0.4),
  ('night_crickets', 'Night Crickets', 'nature', 'Crickets chirping at night', 'sfx/night_crickets.mp3', 'https://your-r2-url/sfx/night_crickets.mp3', 280, 0.3);

-- RLS policies for SFX effects (public read access)
alter table public.sfx_effects enable row level security;
create policy if not exists sfx_effects_public_read on public.sfx_effects for select using (true);

-- RLS policies for space SFX (users can manage their own space's SFX)
alter table public.space_sfx enable row level security;
create policy if not exists space_sfx_select_own_space on public.space_sfx
  for select using (
    exists (
      select 1 from public.spaces s
      where s.id = space_sfx.space_id
        and s.user_id = auth.uid()
    )
  );
create policy if not exists space_sfx_modify_own_space on public.space_sfx
  for all using (
    exists (
      select 1 from public.spaces s
      where s.id = space_sfx.space_id
        and s.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.spaces s
      where s.id = space_sfx.space_id
        and s.user_id = auth.uid()
    )
  );
