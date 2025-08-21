"use client";
import { trpc } from '@/lib/trpcClient';

export function BillingClient() {
  const sub = trpc.billing.getSubscription.useQuery();
  const portal = trpc.billing.createPortalSession.useQuery(undefined, { enabled: false });
  return (
    <div className="text-sm space-y-2">
      <div>Plan: {sub.data?.plan ?? 'free'}</div>
      <button
        className="underline"
        onClick={async () => {
          const res = await fetch('/api/trpc/billing.createPortalSession', { method: 'POST' });
          // In a fuller client, we'd call via trpc mutation and redirect res.url
        }}
      >
        Manage billing
      </button>
    </div>
  );
}


