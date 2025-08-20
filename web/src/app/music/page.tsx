"use client";
import { trpc } from '@/lib/trpcClient';
import { useEffect, useMemo, useState } from 'react';

export default function MusicPage() {
  const [prompt, setPrompt] = useState('cozy lofi, vinyl crackle, mellow, relaxing');
  const [title, setTitle] = useState('Untitled');
  const [spaceId, setSpaceId] = useState('');
  const create = trpc.music.create.useMutation();
  const finalize = trpc.music.finalize.useMutation();
  const { data: songs, refetch } = trpc.music.list.useQuery({}, { refetchInterval: 3000 });

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
        <input className="w-full border rounded px-3 py-2" placeholder="Space ID" value={spaceId} onChange={(e) => setSpaceId(e.target.value)} />
        <input className="w-full border rounded px-3 py-2" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="w-full border rounded px-3 py-2" rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <button className="bg-black text-white px-4 py-2 rounded" type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create'}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-medium">Recent Songs</h2>
        <ul className="space-y-2">
          {songs?.map((s) => (
            <li key={s.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div className="text-sm">
                <div className="font-medium">{s.title ?? 'Untitled'}</div>
                <div className="text-xs text-neutral-500">{s.status}</div>
              </div>
              <div className="space-x-2">
                {s.r2_url ? (
                  <audio controls src={s.r2_url} />
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
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}


