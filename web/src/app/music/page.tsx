"use client";
import { trpc } from '@/lib/trpcClient';
import { useState } from 'react';

export default function MusicPage() {
  const [prompt, setPrompt] = useState('cozy lofi, vinyl crackle, mellow, relaxing');
  const [title, setTitle] = useState('Untitled');
  const [spaceId, setSpaceId] = useState('');
  const create = trpc.music.create.useMutation();
  const finalize = trpc.music.finalize.useMutation();

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
    </main>
  );
}


