import { router } from '../trpc';
import { healthRouter } from './health';
import { spacesRouter } from './spaces';
import { spaceMessagesRouter } from './spaceMessages';
import { songsRouter } from './songs';
import { authRouter } from './auth';
import { musicRouter } from './music';
import { artworkRouter } from './artwork';
import { videoRouter } from './video';

export const appRouter = router({
	health: healthRouter,
	spaces: spacesRouter,
	spaceMessages: spaceMessagesRouter,
	songs: songsRouter,
	auth: authRouter,
	music: musicRouter,
	artwork: artworkRouter,
	video: videoRouter,
});

export type AppRouter = typeof appRouter;


