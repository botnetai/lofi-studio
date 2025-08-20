import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { slugify } from '@/lib/slug';

const visibilitySchema = z.enum(['private', 'public']).default('private');

export const spacesRouter = router({
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().optional(),
      visibility: visibilitySchema.optional(),
      chatEnabled: z.boolean().optional(),
      backgroundArtworkId: z.string().uuid().optional(),
      backgroundVideoId: z.string().uuid().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');
      const supabase = ctx.supabase;
      const desiredSlug = input.slug ?? slugify(input.name);
      // Ensure unique slug
      const { data: existing } = await supabase
        .from('spaces')
        .select('id')
        .eq('slug', desiredSlug)
        .maybeSingle();
      if (existing) throw new Error('Slug already in use');
      const { error, data } = await supabase
        .from('spaces')
        .insert({
          user_id: ctx.user.id,
          name: input.name,
          slug: desiredSlug,
          visibility: input.visibility ?? 'private',
          chat_enabled: input.chatEnabled ?? false,
          background_artwork_id: input.backgroundArtworkId ?? null,
          background_video_id: input.backgroundVideoId ?? null,
          description: input.description ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().optional(),
      visibility: visibilitySchema.optional(),
      chatEnabled: z.boolean().optional(),
      backgroundArtworkId: z.string().uuid().optional(),
      backgroundVideoId: z.string().uuid().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');
      const supabase = ctx.supabase;
      const payload: any = {};
      if (input.name !== undefined) payload.name = input.name;
      if (input.visibility !== undefined) payload.visibility = input.visibility;
      if (input.chatEnabled !== undefined) payload.chat_enabled = input.chatEnabled;
      if (input.backgroundArtworkId !== undefined) payload.background_artwork_id = input.backgroundArtworkId;
      if (input.backgroundVideoId !== undefined) payload.background_video_id = input.backgroundVideoId;
      if (input.description !== undefined) payload.description = input.description;

      const { error, data } = await supabase
        .from('spaces')
        .update(payload)
        .eq('id', input.id)
        .eq('user_id', ctx.user.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');
      const { error } = await ctx.supabase.from('spaces').delete().eq('id', input.id).eq('user_id', ctx.user.id);
      if (error) throw error;
      return { ok: true };
    }),

  list: publicProcedure
    .input(z.object({ cursor: z.string().optional(), limit: z.number().min(1).max(100).optional(), ownerOnly: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      let q = ctx.supabase.from('spaces').select('*').order('created_at', { ascending: false }).limit(limit);
      if (input?.ownerOnly) {
        if (!ctx.user) throw new Error('Unauthorized');
        q = q.eq('user_id', ctx.user.id);
      } else {
        // show own + public
        if (ctx.user) {
          q = q.or(`visibility.eq.public,user_id.eq.${ctx.user.id}`);
        } else {
          q = q.eq('visibility', 'public');
        }
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase.from('spaces').select('*').eq('slug', input.slug).maybeSingle();
      if (error) throw error;
      return data;
    }),
});


