import { publicProcedure, router } from '../trpc';

export const healthRouter = router({
	ping: publicProcedure.query(() => ({ ok: true })),
});


