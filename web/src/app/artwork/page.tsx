"use client";
import { trpc } from '@/lib/trpcClient';
import { useState } from 'react';
import { IMAGE_MODELS, getDefaultModelId } from '@/server/lib/falModels';

export default function ArtworkPage() {
  const [prompt, setPrompt] = useState('cozy room at night, window, rain');
  const [model, setModel] = useState(getDefaultModelId('image') || 'fal-ai/flux-pro');
  const create = trpc.artwork.create.useMutation();
  const { data, refetch, isLoading } = trpc.artwork.list.useQuery({}, { refetchInterval: 5000 });
  return (
    <main className="max-w-4xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Artwork</h1>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await create.mutateAsync({ prompt, model });
          setPrompt('');
          refetch();
        }}
      >
        <input className="w-full border rounded px-3 py-2" placeholder="Prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <select className="w-full border rounded px-3 py-2" value={model} onChange={(e) => setModel(e.target.value)}>
          {IMAGE_MODELS.map((m) => (
            <option key={m.label} value={m.id} disabled={m.disabled}>{m.label}</option>
          ))}
        </select>
        <button className="bg-black text-white px-4 py-2 rounded" disabled={create.isPending}>
          {create.isPending ? 'Generating…' : 'Generate'}
        </button>
      </form>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {data?.map((a) => (
          <div key={a.id} className="border rounded overflow-hidden">
            {a.r2_url ? <img src={a.r2_url} alt="artwork" /> : <div className="h-48 bg-neutral-100" />}
          </div>
        ))}
      </div>
    </main>
  );
}


