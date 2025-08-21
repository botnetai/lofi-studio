import { router } from '../trpc';
import { healthRouter } from './health';
import { spacesRouter } from './spaces';
import { spaceMessagesRouter } from './spaceMessages';
import { songsRouter } from './songs';
import { authRouter } from './auth';
import { musicRouter } from './music';
import { artworkRouter } from './artwork';
import { videoRouter } from './video';
import { modelsRouter } from './models';
import { billingRouter } from './billing';
import { sfxRouter } from './sfx';

export const appRouter = router({
	health: healthRouter,
	spaces: spacesRouter,
	spaceMessages: spaceMessagesRouter,
	songs: songsRouter,
	auth: authRouter,
	music: musicRouter,
	artwork: artworkRouter,
	video: videoRouter,
	models: modelsRouter,
	billing: billingRouter,
	sfx: sfxRouter,
});

export type AppRouter = typeof appRouter;


