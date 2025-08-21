import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { invokeFal } from '@/server/lib/fal';
import { IMAGE_MODEL_SCHEMAS } from '@/lib/falModels';
import { putObjectToR2, publicR2Url } from '@/server/lib/r2';

export const artworkRouter = router({
  create: publicProcedure
    .input(z.object({ modelId: z.string().min(1), params: z.record(z.string(), z.any()) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');
      // Validate model against schema
      const schema = IMAGE_MODEL_SCHEMAS.find((s) => s.id === input.modelId);
      if (!schema) throw new Error('Unsupported model');
      // Build dynamic zod validator from schema fields
      const shape: Record<string, any> = {};
      for (const f of schema.fields) {
        let zf: any = f.type === 'text' ? z.string() : f.type === 'number' ? z.number() : f.type === 'boolean' ? z.boolean() : z.string();
        if (f.required) zf = zf;
        else zf = zf.optional();
        if (f.type === 'number') {
          if (f.min !== undefined) zf = zf.min(f.min);
          if (f.max !== undefined) zf = zf.max(f.max);
        }
        shape[f.key] = zf;
      }
      const validator = z.object(shape);
      const validated = validator.parse(input.params);

      const { data: row, error: insErr } = await ctx.supabase
        .from('artwork')
        .insert({ user_id: ctx.user.id, prompt: String(validated.prompt ?? ''), model: input.modelId, status: 'queued' })
        .select('*')
        .single();
      if (insErr) throw insErr;
      const result = await invokeFal(input.modelId, validated as any);
      const imageUrl = (result as any).images?.[0]?.url ?? (result as any).data?.image?.url ?? (result as any).data?.images?.[0]?.url;
      if (!imageUrl) throw new Error('Fal artwork: missing image URL');
      const res = await fetch(imageUrl);
      const key = `artwork/${row.id}.png`;
      await putObjectToR2({ key, body: res.body as any, contentType: res.headers.get('content-type') ?? 'image/png' });
      const url = publicR2Url(key);
      const { error: upErr } = await ctx.supabase
        .from('artwork')
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


