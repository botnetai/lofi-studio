import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

export const spaceMessagesRouter = router({
  list: publicProcedure
    .input(z.object({ spaceId: z.string().uuid(), cursor: z.string().optional(), limit: z.number().min(1).max(100).optional() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('space_messages')
        .select('*')
        .eq('space_id', input.spaceId)
        .order('created_at', { ascending: false })
        .limit(input.limit ?? 50);
      if (error) throw error;
      return data ?? [];
    }),

  post: publicProcedure
    .input(z.object({ spaceId: z.string().uuid(), message: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');
      const { error, data } = await ctx.supabase
        .from('space_messages')
        .insert({ space_id: input.spaceId, user_id: ctx.user.id, message: input.message })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }),
});


