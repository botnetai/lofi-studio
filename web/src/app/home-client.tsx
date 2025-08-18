"use client";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpcClient";

export default function HomeClient() {
  const ping = trpc.health.ping.useQuery();
  return (
    <main className="max-w-4xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Lofi Studio</h1>
      <div className="text-sm text-neutral-500">tRPC health: {String(ping.data?.ok ?? false)}</div>
      <div className="space-x-2">
        <Button>Primary</Button>
        <Button variant="outline">Outline</Button>
      </div>
    </main>
  );
}


