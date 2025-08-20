import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { createVideo } from '@/server/lib/fal';
import { putObjectToR2, publicR2Url } from '@/server/lib/r2';

export const videoRouter = router({
  create: publicProcedure
    .input(z.object({ artworkId: z.string().uuid().optional(), prompt: z.string().optional(), model: z.string().optional(), duration: z.number().min(1).max(30).optional(), mode: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');
      let artworkUrl: string | undefined;
      if (input.artworkId) {
        const { data: art } = await ctx.supabase.from('artwork').select('r2_url').eq('id', input.artworkId).eq('user_id', ctx.user.id).maybeSingle();
        artworkUrl = art?.r2_url ?? undefined;
      }
      const { data: row, error: insErr } = await ctx.supabase
        .from('videos')
        .insert({ user_id: ctx.user.id, artwork_id: input.artworkId ?? null, prompt: input.prompt ?? null, model: input.model ?? 'fal-ai/kling-2.1', status: 'queued' })
        .select('*')
        .single();
      if (insErr) throw insErr;

      const gen = await createVideo({ prompt: input.prompt, artworkUrl, model: input.model, duration: input.duration, mode: input.mode });
      const res = await fetch(gen.videoUrl);
      const key = `videos/${row.id}.mp4`;
      await putObjectToR2({ key, body: res.body as any, contentType: res.headers.get('content-type') ?? 'video/mp4' });
      const url = publicR2Url(key);
      const { error: upErr } = await ctx.supabase
        .from('videos')
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
        .from('videos')
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
      const { error } = await ctx.supabase.from('videos').delete().eq('id', input.id).eq('user_id', ctx.user.id);
      if (error) throw error;
      return { ok: true };
    }),
});


