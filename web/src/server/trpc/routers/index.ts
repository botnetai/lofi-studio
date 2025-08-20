import { router } from '../trpc';
import { healthRouter } from './health';
import { spacesRouter } from './spaces';
import { spaceMessagesRouter } from './spaceMessages';

export const appRouter = router({
	health: healthRouter,
	spaces: spacesRouter,
	spaceMessages: spaceMessagesRouter,
});

export type AppRouter = typeof appRouter;


