"use client";
import { trpc } from '@/lib/trpcClient';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { SFXSelector } from '@/components/SFXSelector';

export default function ManageSpacePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  const space = trpc.spaces.getBySlug.useQuery({ slug });
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const update = trpc.spaces.update.useMutation();
  const del = trpc.spaces.delete.useMutation({ onSuccess: () => router.push('/spaces') });
  const songs = trpc.songs.list.useQuery({ spaceId: space.data?.id ?? '00000000-0000-0000-0000-000000000000' }, { enabled: !!space.data?.id });
  const reorder = trpc.songs.reorder.useMutation({ onSuccess: () => songs.refetch() });
  const artworks = trpc.artwork.list.useQuery({}, { enabled: !!space.data?.id });
  const videos = trpc.video.list.useQuery({}, { enabled: !!space.data?.id });
  // SFX functionality commented out for MVP
  // const spaceSFX = trpc.sfx.getSpaceEffects.useQuery({ spaceId: space.data?.id ?? '' }, { enabled: !!space.data?.id });

  useEffect(() => {
    if (space.data) {
      setName(space.data.name);
      setVisibility(space.data.visibility);
    }
  }, [space.data]);

  const [order, setOrder] = useState<string[]>([]);
  useEffect(() => {
    if (songs.data) setOrder(songs.data.map((s) => s.id));
  }, [songs.data]);

  function move(idx: number, dir: -1 | 1) {
    setOrder((prev) => {
      const arr = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return arr;
      const [item] = arr.splice(idx, 1);
      arr.splice(j, 0, item);
      return arr;
    });
  }

  if (space.isLoading) return <div className="p-8">Loading…</div>;
  if (!space.data) return <div className="p-8">Not found</div>;

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Manage: {space.data.name}</h1>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ id: space.data!.id, name, visibility });
        }}
      >
        <input className="w-full border rounded px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="w-full border rounded px-3 py-2" value={visibility} onChange={(e) => setVisibility(e.target.value as any)}>
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
        <button className="bg-black text-white px-4 py-2 rounded" type="submit">Save</button>
      </form>

      <section className="space-y-2">
        <h2 className="font-medium">Songs</h2>
        <ul className="space-y-2">
          {songs.data?.map((s, i) => (
            <li key={s.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div className="text-sm">{s.title ?? `Track ${i + 1}`}</div>
              <div className="space-x-1">
                <button className="px-2 py-1 border rounded" onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </button>
                <button className="px-2 py-1 border rounded" onClick={() => move(i, 1)} disabled={i === (songs.data?.length ?? 1) - 1}>
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button
          className="bg-black text-white px-4 py-2 rounded"
          disabled={!order.length || reorder.isPending}
          onClick={() => reorder.mutate({ spaceId: space.data!.id, songIdsInOrder: order })}
        >
          {reorder.isPending ? 'Saving…' : 'Save Order'}
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Background</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {artworks.data?.map((a) => (
            <button
              key={a.id}
              className="border rounded overflow-hidden"
              onClick={() => update.mutate({ id: space.data!.id, backgroundArtworkId: a.id, backgroundVideoId: undefined })}
            >
              {a.r2_url ? <img src={a.r2_url} alt="artwork" /> : <div className="h-24 bg-neutral-100" />}
            </button>
          ))}
          {videos.data?.map((v) => (
            <button
              key={v.id}
              className="border rounded overflow-hidden"
              onClick={() => update.mutate({ id: space.data!.id, backgroundVideoId: v.id, backgroundArtworkId: undefined })}
            >
              {v.r2_url ? <video src={v.r2_url} muted /> : <div className="h-24 bg-neutral-100" />}
            </button>
          ))}
        </div>
      </section>

      {/* SFX functionality commented out for MVP */}
      {/*
      <section className="space-y-2">
        <h2 className="font-medium">SFX Effects</h2>
        <SFXSelector
          spaceId={space.data!.id}
          currentSFX={spaceSFX.data ?? []}
          onSFXChange={() => spaceSFX.refetch()}
        />
      </section>
      */}

      <button className="text-red-600 underline" onClick={() => del.mutate({ id: space.data!.id })}>Delete Space</button>
    </main>
  );
}


