import Link from 'next/link';
import { trpc } from '@/lib/trpcClient';

export const dynamic = 'force-dynamic';

export default function SpacesPage() {
  const { data, isLoading, error } = trpc.spaces.list.useQuery({ ownerOnly: true });
  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Your Spaces</h1>
      {isLoading && <div>Loading…</div>}
      {error && <div className="text-red-600 text-sm">{error.message}</div>}
      <ul className="space-y-3">
        {data?.map((s) => (
          <li key={s.id} className="border rounded p-3">
            <div className="font-medium">{s.name}</div>
            <div className="text-xs text-neutral-500">/{s.slug}</div>
            <Link className="underline text-sm" href={`/space/${s.slug}`}>Open</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}


