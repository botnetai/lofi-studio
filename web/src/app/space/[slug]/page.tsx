"use client";
import { trpc } from '@/lib/trpcClient';

export default function SpacePublicPage({ params }: { params: { slug: string } }) {
  const space = trpc.spaces.getBySlug.useQuery({ slug: params.slug });
  const messages = trpc.spaceMessages.list.useQuery({ spaceId: space.data?.id ?? '00000000-0000-0000-0000-000000000000' }, { enabled: !!space.data?.id });

  if (space.isLoading) return <div className="p-8">Loading…</div>;
  if (!space.data) return <div className="p-8">Not found</div>;

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">{space.data.name}</h1>
      <div className="text-sm text-neutral-500">Visibility: {space.data.visibility}</div>
      <section>
        <h2 className="font-medium mb-2">Messages</h2>
        <ul className="space-y-2">
          {messages.data?.map((m) => (
            <li key={m.id} className="text-sm">
              {m.message}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}


