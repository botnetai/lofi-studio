import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

export const songsRouter = router({
  list: publicProcedure
    .input(z.object({ spaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('songs')
        .select('*')
        .eq('space_id', input.spaceId)
        .order('position', { ascending: true });
      if (error) throw error;
      return data ?? [];
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');
      const { error } = await ctx.supabase.from('songs').delete().eq('id', input.id).eq('user_id', ctx.user.id);
      if (error) throw error;
      return { ok: true };
    }),

  reorder: publicProcedure
    .input(z.object({ spaceId: z.string().uuid(), songIdsInOrder: z.array(z.string().uuid()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');
      // Ownership check: ensure all songs belong to the user
      const { data: songs, error: fetchErr } = await ctx.supabase
        .from('songs')
        .select('id,user_id')
        .eq('space_id', input.spaceId);
      if (fetchErr) throw fetchErr;
      if (!songs || songs.some((s) => s.user_id !== ctx.user!.id)) throw new Error('Forbidden');

      const { error } = await ctx.supabase.rpc('reorder_songs', {
        space_id: input.spaceId,
        song_ids: input.songIdsInOrder,
      });
      if (error) throw error;
      return { ok: true };
    }),
});


