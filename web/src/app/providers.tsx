"use client";
import { trpc } from '@/lib/trpcClient';
import { httpBatchLink } from '@trpc/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
	const [queryClient] = React.useState(() => new QueryClient());
	const [trpcClient] = React.useState(() =>
		trpc.createClient({
			links: [httpBatchLink({ url: '/api/trpc' })],
		}),
	);

	return (
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</trpc.Provider>
	);
}


