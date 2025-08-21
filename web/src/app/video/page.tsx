"use client";
import { trpc } from '@/lib/trpcClient';
import { useState, useEffect } from 'react';
import { T2V_MODELS, I2V_MODELS, getDefaultModelId } from '@/lib/falModels';
import { DynamicModelForm } from '@/components/DynamicModelForm';

export default function VideoPage() {
  const [prompt, setPrompt] = useState('cozy lofi loop, light movement');
  const [artworkId, setArtworkId] = useState('');
  const isImg2Vid = !!artworkId;
  const [model, setModel] = useState(getDefaultModelId('text2video') || 'fal-ai/kling-2.1');
  const schema = trpc.models.get.useQuery({ id: model }, { staleTime: 60_000 });
  const [formValues, setFormValues] = useState<Record<string, any>>({ prompt });
  
  useEffect(() => setFormValues((v) => ({ ...v, prompt })), [prompt]);
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
          await create.mutateAsync({ modelId: model, params: { ...formValues }, artworkId: artworkId || undefined });
          refetch();
        }}
      >
        <select className="w-full border rounded px-3 py-2" value={artworkId} onChange={(e) => {
          const val = e.target.value;
          setArtworkId(val);
          const nextDefault = getDefaultModelId(val ? 'img2video' : 'text2video');
          if (nextDefault) setModel(nextDefault);
        }}>
          <option value="">No artwork (prompt-only)</option>
          {artwork.data?.map((a) => (
            <option key={a.id} value={a.id}>Artwork {a.id.slice(0, 6)}</option>
          ))}
        </select>
        <select className="w-full border rounded px-3 py-2" value={model} onChange={(e) => setModel(e.target.value)}>
          {(isImg2Vid ? I2V_MODELS : T2V_MODELS).map((m) => (
            <option key={m.label} value={m.id} disabled={m.disabled}>{m.label}</option>
          ))}
        </select>
        {schema.data && <DynamicModelForm fields={schema.data.fields} values={formValues} onChange={setFormValues} />}
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


