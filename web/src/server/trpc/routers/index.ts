import { router } from '../trpc';
import { healthRouter } from './health';
import { spacesRouter } from './spaces';
import { spaceMessagesRouter } from './spaceMessages';
import { songsRouter } from './songs';
import { authRouter } from './auth';

export const appRouter = router({
	health: healthRouter,
	spaces: spacesRouter,
	spaceMessages: spaceMessagesRouter,
	songs: songsRouter,
	auth: authRouter,
});

export type AppRouter = typeof appRouter;


