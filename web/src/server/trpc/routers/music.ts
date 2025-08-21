import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { startGeneration, fetchStatus, downloadStream } from '@/server/lib/elevenlabs';
import { putObjectToR2, publicR2Url, deleteObjectFromR2 } from '@/server/lib/r2';
import { Readable } from 'node:stream';

export const musicRouter = router({
  create: publicProcedure
    .input(z.object({ spaceId: z.string().uuid(), prompt: z.string().min(1), title: z.string().optional(), style: z.string().optional(), makeInstrumental: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');

      // Idempotency check: look for existing song with same parameters to prevent duplicates
      const { data: existingSong } = await ctx.supabase
        .from('songs')
        .select('*')
        .eq('user_id', ctx.user.id)
        .eq('space_id', input.spaceId)
        .eq('prompt', input.prompt)
        .eq('title', input.title ?? null)
        .in('status', ['queued', 'generating', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSong) {
        // Return existing song if it's still processing or completed
        return {
          id: existingSong.id,
          generationId: existingSong.generation_id,
          status: existingSong.status
        };
      }

      // Insert queued song with next position
      const { data: last, error: lastErr } = await ctx.supabase
        .from('songs')
        .select('position')
        .eq('space_id', input.spaceId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastErr) throw lastErr;
      const nextPos = last ? (last.position ?? 0) + 1 : 0;

      const { data: row, error: insErr } = await ctx.supabase
        .from('songs')
        .insert({
          user_id: ctx.user.id,
          space_id: input.spaceId,
          position: nextPos,
          title: input.title ?? null,
          prompt: input.prompt,
          status: 'queued'
        })
        .select('*')
        .single();
      if (insErr) throw insErr;

      try {
        const { generationId } = await startGeneration({
          prompt: input.prompt,
          title: input.title,
          style: input.style,
          makeInstrumental: input.makeInstrumental
        });
        await ctx.supabase.from('songs').update({ status: 'generating', generation_id: generationId }).eq('id', row.id);
        return { id: row.id, generationId };
      } catch (error) {
        // If generation start fails, mark as failed and re-throw
        await ctx.supabase.from('songs').update({ status: 'failed' }).eq('id', row.id);
        throw error;
      }
    }),

  status: publicProcedure
    .input(z.object({ id: z.string().uuid().optional(), generationId: z.string().optional() }))
    .query(async ({ input }) => {
      if (!input.generationId) return { status: 'unknown' };
      return fetchStatus(input.generationId);
    }),

  list: publicProcedure
    .input(z.object({ cursor: z.string().optional(), limit: z.number().min(1).max(100).optional(), status: z.string().optional(), spaceId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      let q = ctx.supabase.from('songs').select('*').order('created_at', { ascending: false }).limit(input?.limit ?? 20);
      if (input?.status) q = q.eq('status', input.status);
      if (input?.spaceId) q = q.eq('space_id', input.spaceId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');
      // Fetch r2_key for deletion
      const { data: song } = await ctx.supabase.from('songs').select('r2_key').eq('id', input.id).eq('user_id', ctx.user.id).maybeSingle();
      const { error } = await ctx.supabase.from('songs').delete().eq('id', input.id).eq('user_id', ctx.user.id);
      if (error) throw error;
      if (song?.r2_key) await deleteObjectFromR2(song.r2_key);
      return { ok: true };
    }),

  finalize: publicProcedure
    .input(z.object({ id: z.string().uuid(), generationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');

      // Idempotency check: if already completed, return existing result
      const { data: existingSong } = await ctx.supabase
        .from('songs')
        .select('status, r2_url')
        .eq('id', input.id)
        .eq('user_id', ctx.user.id)
        .maybeSingle();

      if (existingSong?.status === 'completed' && existingSong.r2_url) {
        return { ok: true, url: existingSong.r2_url } as const;
      }

      if (existingSong?.status === 'failed') {
        return { ok: false, status: 'failed' } as const;
      }

      const status = await fetchStatus(input.generationId);
      if (status.status !== 'completed' || !status.url) return { ok: false, status: status.status } as const;

      const res = await downloadStream(status.url);
      const key = `music/${input.id}.mp3`;
      const body: any = (res.body && (res.body as any).getReader) ? Readable.fromWeb(res.body as any) : res.body;
      await putObjectToR2({ key, body, contentType: 'audio/mpeg' });
      const r2Url = publicR2Url(key);

      const { error } = await ctx.supabase
        .from('songs')
        .update({ status: 'completed', r2_key: key, r2_url: r2Url, duration_seconds: status.duration_seconds ?? null })
        .eq('id', input.id)
        .eq('user_id', ctx.user.id);

      if (error) throw error;
      return { ok: true, url: r2Url } as const;
    }),


});


