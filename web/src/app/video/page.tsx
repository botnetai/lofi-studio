"use client";
import { trpc } from '@/lib/trpcClient';
import { useState } from 'react';

export default function VideoPage() {
  const [prompt, setPrompt] = useState('cozy lofi loop, light movement');
  const [artworkId, setArtworkId] = useState('');
  const create = trpc.video.create.useMutation();
  const artwork = trpc.artwork.list.useQuery({});
  const { data, isLoading, refetch } = trpc.video.list.useQuery({}, { refetchInterval: 7000 });
  return (
    <main className="max-w-4xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Video</h1>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await create.mutateAsync({ prompt, artworkId: artworkId || undefined });
          refetch();
        }}
      >
        <select className="w-full border rounded px-3 py-2" value={artworkId} onChange={(e) => setArtworkId(e.target.value)}>
          <option value="">No artwork (prompt-only)</option>
          {artwork.data?.map((a) => (
            <option key={a.id} value={a.id}>Artwork {a.id.slice(0, 6)}</option>
          ))}
        </select>
        <input className="w-full border rounded px-3 py-2" placeholder="Prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <button className="bg-black text-white px-4 py-2 rounded" disabled={create.isPending}>
          {create.isPending ? 'Generating…' : 'Generate'}
        </button>
      </form>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data?.map((v) => (
          <div key={v.id} className="border rounded overflow-hidden">
            {v.r2_url ? (
              <video src={v.r2_url} controls muted loop />
            ) : (
              <div className="h-48 bg-neutral-100" />
            )}
          </div>
        ))}
      </div>
    </main>
  );
}


