-- db/migrations/0002_add_reorder_function.sql
-- Atomic song reordering in a single transaction using a server-side function

create or replace function public.reorder_songs(
  space_id uuid,
  song_ids uuid[]
)
returns void
language plpgsql
as $$
declare
  total_space_songs int;
  total_input int;
  matched int;
begin
  -- Validate inputs
  if space_id is null then
    raise exception 'space_id is required';
  end if;
  if song_ids is null or array_length(song_ids, 1) is null then
    raise exception 'song_ids must be a non-empty array';
  end if;

  select count(*) into total_space_songs from public.songs where space_id = reorder_songs.space_id;
  total_input := array_length(song_ids, 1);

  if total_input <> total_space_songs then
    raise exception 'song_ids must include all songs in the space (expected %, got %)', total_space_songs, total_input;
  end if;

  -- Ensure all passed ids belong to the space
  select count(*) into matched
  from public.songs s
  join unnest(song_ids) as u(id) on s.id = u.id
  where s.space_id = reorder_songs.space_id;

  if matched <> total_input then
    raise exception 'song_ids contains ids not in the space';
  end if;

  -- Avoid unique constraint conflicts during assignment
  update public.songs set position = position + 10000 where space_id = reorder_songs.space_id;

  -- Assign new sequential positions based on array order
  update public.songs s
  set position = u.ord - 1
  from unnest(song_ids) with ordinality as u(id, ord)
  where s.id = u.id and s.space_id = reorder_songs.space_id;

  return;
end;
$$;


