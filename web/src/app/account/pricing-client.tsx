"use client";
import { trpc } from '@/lib/trpcClient';

export function BillingClient() {
  const sub = trpc.billing.getSubscription.useQuery();
  const portal = trpc.billing.createPortalSession.useMutation();
  return (
    <div className="text-sm space-y-2">
      <div>Plan: {sub.data?.plan ?? 'free'}</div>
      <button
        className="underline"
        onClick={async () => {
          const res = await portal.mutateAsync();
          if ((res as any)?.url) window.location.href = (res as any).url;
        }}
      >
        Manage billing
      </button>
    </div>
  );
}


