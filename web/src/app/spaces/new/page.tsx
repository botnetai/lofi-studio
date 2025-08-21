"use client";
import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpcClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { slugify } from '@/lib/slug';

export default function NewSpacePage() {
  const router = useRouter();
  const me = trpc.auth.me.useQuery();
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const create = trpc.spaces.create.useMutation({
    onSuccess: (space) => router.push(`/space/${space.slug}`),
  });
  const previewSlug = useMemo(() => (name ? slugify(name) : ''), [name]);

  // If not authenticated, gate the page with a friendly prompt
  if (me.data === null) {
    return (
      <main className="max-w-md mx-auto p-8 space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Create Space</h1>
        <p className="text-gray-600 dark:text-gray-300">
          You need to be signed in to create a space.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/login" className="gradient-bg text-white px-5 py-2 rounded-md font-medium">Sign in</Link>
          <Link href="/" className="px-5 py-2 rounded-md border">Go Home</Link>
        </div>
      </main>
    );
  }
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
        {name && (
          <div className="text-xs text-gray-500">Preview URL: /space/{previewSlug}</div>
        )}
        <button disabled={!name || create.isPending} className="bg-black text-white px-4 py-2 rounded" type="submit">
          {create.isPending ? 'Creating…' : 'Create'}
        </button>
        {create.error && (
          <div className="text-sm text-red-600">
            {create.error.message === 'Unauthorized' && (
              <span>
                You need to be signed in. <Link href="/login" className="underline">Sign in</Link>
              </span>
            )}
            {create.error.message?.includes('Space limit') && (
              <span>
                {create.error.message}. Consider upgrading on{' '}
                <Link href="/pricing" className="underline">Pricing</Link>.
              </span>
            )}
            {!['Unauthorized'].includes(create.error.message || '') && !create.error.message?.includes('Space limit') && (
              <span>{create.error.message}</span>
            )}
          </div>
        )}
      </form>
    </main>
  );
}


