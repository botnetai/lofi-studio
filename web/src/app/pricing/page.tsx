"use client";
import { trpc } from '@/lib/trpcClient';

export default function PricingPage() {
  const checkout = trpc.billing.createCheckoutSession.useMutation();
  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Pricing</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded p-6">
          <h2 className="font-medium text-lg mb-2">Free</h2>
          <ul className="text-sm list-disc pl-4 space-y-1">
            <li>1 Space total</li>
          </ul>
        </div>
        <div className="border rounded p-6">
          <h2 className="font-medium text-lg mb-2">Pro</h2>
          <ul className="text-sm list-disc pl-4 space-y-1">
            <li>Up to 10 Spaces</li>
          </ul>
          <button
            className="mt-4 bg-black text-white px-4 py-2 rounded"
            onClick={async () => {
              const res = await checkout.mutateAsync({ plan: 'pro_monthly' });
              if (res.url) window.location.href = res.url;
            }}
          >
            Upgrade
          </button>
        </div>
      </div>
    </main>
  );
}


