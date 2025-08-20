"use client";
import { trpc } from '@/lib/trpcClient';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function MusicPage() {
  const [prompt, setPrompt] = useState('cozy lofi, vinyl crackle, mellow, relaxing');
  const [title, setTitle] = useState('Untitled');
  const [spaceId, setSpaceId] = useState('');
  const create = trpc.music.create.useMutation();
  const finalize = trpc.music.finalize.useMutation();
  const { data: songs, refetch, isLoading } = trpc.music.list.useQuery({}, { refetchInterval: 3000 });
  const spaces = trpc.spaces.list.useQuery({ ownerOnly: true });
  const remove = trpc.music.delete.useMutation({ onSuccess: () => refetch() });
  const check = trpc.music.check.useMutation({ onSuccess: () => refetch() });
  const lastCheckedRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!songs) return;
    const now = Date.now();
    const todo = songs.filter((s) => s.status === 'generating' && s.generation_id);
    for (const s of todo) {
      const key = s.generation_id as string;
      const last = lastCheckedRef.current[key] ?? 0;
      if (now - last > 15000) {
        lastCheckedRef.current[key] = now;
        check.mutate({ id: s.id, generationId: key });
      }
    }
  }, [songs]);

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Generate Music</h1>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await create.mutateAsync({ spaceId, prompt, title });
          // optional: poll/finalize manually
        }}
      >
        <select className="w-full border rounded px-3 py-2" value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
          <option value="">Select a space…</option>
          {spaces.data?.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input className="w-full border rounded px-3 py-2" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="w-full border rounded px-3 py-2" rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <button className="bg-black text-white px-4 py-2 rounded" type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create'}
        </button>
        {create.error && <div className="text-sm text-red-600">{create.error.message}</div>}
      </form>

      <section className="space-y-3">
        <h2 className="font-medium">Recent Songs</h2>
        {isLoading && (
          <ul className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="animate-pulse h-12 bg-neutral-100 rounded" />
            ))}
          </ul>
        )}
        <ul className="space-y-2">
          {songs?.map((s) => (
            <li key={s.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div className="text-sm">
                <div className="font-medium">{s.title ?? 'Untitled'}</div>
                <div className="text-xs text-neutral-500">
                  {s.status} • {s.duration_seconds ? `${s.duration_seconds}s` : '—'} • {new Date(s.created_at).toLocaleString()}
                </div>
              </div>
              <div className="space-x-2">
                {s.r2_url ? (
                  <audio controls src={s.r2_url} onError={() => finalize.mutate({ id: s.id, generationId: s.generation_id! })} />
                ) : (
                  <button
                    className="px-2 py-1 border rounded"
                    onClick={async () => {
                      if (!s.generation_id) return;
                      await finalize.mutateAsync({ id: s.id, generationId: s.generation_id });
                      refetch();
                    }}
                  >
                    Finalize
                  </button>
                )}
                <button
                  className="px-2 py-1 border rounded text-red-600"
                  onClick={async () => {
                    if (!confirm('Delete this song?')) return;
                    await remove.mutateAsync({ id: s.id });
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}


