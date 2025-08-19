import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

export const runtime = 'nodejs';
import { appRouter } from '@/server/trpc/routers';
import { createContext } from '@/server/trpc/context';

const handler = (req: Request) =>
	fetchRequestHandler({
		endpoint: '/api/trpc',
		req,
		router: appRouter,
		createContext,
	});

export { handler as GET, handler as POST };


