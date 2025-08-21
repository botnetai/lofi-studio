"use client";
import { trpc } from '@/lib/trpcClient';
import { httpBatchLink } from '@trpc/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import React from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
	const [queryClient] = React.useState(() =>
		new QueryClient({
			defaultOptions: {
				queries: {
					// Cache successful queries for 5 minutes
					staleTime: 1000 * 60 * 5,
					// Keep queries in cache for 10 minutes after unmount
					gcTime: 1000 * 60 * 10,
					// Retry failed requests up to 2 times with exponential backoff
					retry: (failureCount, error) => {
						// Don't retry on 4xx errors (client errors)
						if (error && typeof error === 'object' && 'status' in error) {
							const status = (error as any).status;
							if (status >= 400 && status < 500) {
								return false;
							}
						}
						return failureCount < 2;
					},
					// Refetch on window focus only for important queries
					refetchOnWindowFocus: false,
					// Refetch on mount only if data is stale
					refetchOnMount: true,
				},
				mutations: {
					// Retry mutations once on network errors
					retry: (failureCount, error) => {
						if (error && typeof error === 'object' && 'status' in error) {
							const status = (error as any).status;
							if (status >= 400 && status < 500) {
								return false;
							}
						}
						return failureCount < 1;
					},
				},
			},
		})
	);

	const [trpcClient] = React.useState(() =>
		trpc.createClient({
			links: [httpBatchLink({ url: '/api/trpc' })],
		}),
	);

	return (
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>
				{children}
				<Toaster />
			</QueryClientProvider>
		</trpc.Provider>
	);
}


