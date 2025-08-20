import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { createArtwork } from '@/server/lib/fal';
import { putObjectToR2, publicR2Url } from '@/server/lib/r2';

export const artworkRouter = router({
  create: publicProcedure
    .input(z.object({ prompt: z.string().min(1), model: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');
      const { data: row, error: insErr } = await ctx.supabase
        .from('artwork')
        .insert({ user_id: ctx.user.id, prompt: input.prompt, model: input.model ?? 'fal-ai/flux-pro', status: 'queued' })
        .select('*')
        .single();
      if (insErr) throw insErr;

      const gen = await createArtwork({ prompt: input.prompt, model: input.model });
      const res = await fetch(gen.imageUrl);
      const key = `artwork/${row.id}.png`;
      await putObjectToR2({ key, body: res.body as any, contentType: res.headers.get('content-type') ?? 'image/png' });
      const url = publicR2Url(key);
      const { error: upErr } = await ctx.supabase
        .from('artwork')
        .update({ status: 'completed', r2_key: key, r2_url: url, request_id: gen.requestId })
        .eq('id', row.id)
        .eq('user_id', ctx.user.id);
      if (upErr) throw upErr;
      return { id: row.id, url };
    }),

  list: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('artwork')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(input?.limit ?? 50);
      if (error) throw error;
      return data ?? [];
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');
      const { error } = await ctx.supabase.from('artwork').delete().eq('id', input.id).eq('user_id', ctx.user.id);
      if (error) throw error;
      return { ok: true };
    }),
});


