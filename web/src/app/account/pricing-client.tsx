"use client";
import { trpc } from '@/lib/trpcClient';

interface PortalResponse {
  url?: string;
}

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
          const portalResponse = res as PortalResponse;
          if (portalResponse?.url) window.location.href = portalResponse.url;
        }}
      >
        Manage billing
      </button>
    </div>
  );
}


