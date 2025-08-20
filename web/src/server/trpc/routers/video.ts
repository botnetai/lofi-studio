import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { invokeFal } from '@/server/lib/fal';
import { I2V_MODEL_SCHEMAS, T2V_MODEL_SCHEMAS } from '@/lib/falModels';
import { z } from 'zod';
import { putObjectToR2, publicR2Url } from '@/server/lib/r2';

export const videoRouter = router({
  create: publicProcedure
    .input(z.object({ modelId: z.string().min(1), params: z.record(z.any()), artworkId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');
      // Resolve artwork URL if provided
      let artworkUrl: string | undefined;
      if (input.artworkId) {
        const { data: art } = await ctx.supabase.from('artwork').select('r2_url').eq('id', input.artworkId).eq('user_id', ctx.user.id).maybeSingle();
        artworkUrl = art?.r2_url ?? undefined;
      }
      // Validate model schema dynamically
      const allSchemas = [...T2V_MODEL_SCHEMAS, ...I2V_MODEL_SCHEMAS];
      const schema = allSchemas.find((s) => s.id === input.modelId);
      if (!schema) throw new Error('Unsupported model');
      const shape: Record<string, any> = {};
      for (const f of schema.fields) {
        let zf: any = f.type === 'text' ? z.string() : f.type === 'number' ? z.number() : f.type === 'boolean' ? z.boolean() : z.string();
        if (f.required) zf = zf; else zf = zf.optional();
        if (f.type === 'number') { if (f.min !== undefined) zf = zf.min(f.min); if (f.max !== undefined) zf = zf.max(f.max); }
        shape[f.key] = zf;
      }
      const validator = z.object(shape);
      const validated = validator.parse(input.params);
      if (artworkUrl) (validated as any).image_url = artworkUrl;
      const { data: row, error: insErr } = await ctx.supabase
        .from('videos')
        .insert({ user_id: ctx.user.id, artwork_id: input.artworkId ?? null, prompt: String(validated.prompt ?? ''), model: input.modelId, status: 'queued' })
        .select('*')
        .single();
      if (insErr) throw insErr;
      const result = await invokeFal(input.modelId, validated as any);
      const videoUrl = (result as any).video?.url ?? (result as any).data?.video?.url ?? (result as any).data?.videos?.[0]?.url;
      if (!videoUrl) throw new Error('Fal video: missing video URL');
      const res = await fetch(videoUrl);
      const key = `videos/${row.id}.mp4`;
      await putObjectToR2({ key, body: res.body as any, contentType: res.headers.get('content-type') ?? 'video/mp4' });
      const url = publicR2Url(key);
      const { error: upErr } = await ctx.supabase
        .from('videos')
        .update({ status: 'completed', r2_key: key, r2_url: url, request_id: String((result as any).request_id ?? (result as any).id ?? '') })
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


