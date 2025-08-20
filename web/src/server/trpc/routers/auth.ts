import { router, publicProcedure } from '../trpc';

export const authRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    return ctx.user ? { id: ctx.user.id, email: ctx.user.email } : null;
  }),
});


