"use client";
import { useState } from 'react';
import { trpc } from '@/lib/trpcClient';
import { useRouter } from 'next/navigation';

export default function NewSpacePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const create = trpc.spaces.create.useMutation({
    onSuccess: (space) => router.push(`/space/${space.slug}`),
  });
  return (
    <main className="max-w-md mx-auto p-8 space-y-4">
      <h1 className="text-xl font-semibold">Create Space</h1>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ name, visibility });
        }}
      >
        <input className="w-full border rounded px-3 py-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="w-full border rounded px-3 py-2" value={visibility} onChange={(e) => setVisibility(e.target.value as any)}>
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
        <button disabled={!name || create.isPending} className="bg-black text-white px-4 py-2 rounded" type="submit">
          {create.isPending ? 'Creating…' : 'Create'}
        </button>
        {create.error && <div className="text-sm text-red-600">{create.error.message}</div>}
      </form>
    </main>
  );
}


