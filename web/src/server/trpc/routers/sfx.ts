import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

export const sfxRouter = router({
  // Get all available SFX effects
  listEffects: publicProcedure
    .input(z.object({
      category: z.enum(['nature', 'ambience', 'weather', 'urban', 'other']).optional()
    }).optional())
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase.from('sfx_effects').select('*').order('category', { ascending: true }).order('display_name', { ascending: true });

      if (input?.category) {
        query = query.eq('category', input.category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    }),

  // Get SFX effects for a specific space
  getSpaceEffects: publicProcedure
    .input(z.object({ spaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');

      // Verify user owns the space
      const { data: space } = await ctx.supabase
        .from('spaces')
        .select('id')
        .eq('id', input.spaceId)
        .eq('user_id', ctx.user.id)
        .maybeSingle();

      if (!space) throw new Error('Space not found or access denied');

      const { data, error } = await ctx.supabase
        .from('space_sfx')
        .select(`
          id,
          gain,
          position,
          sfx_effect_id,
          sfx_effects (
            id,
            name,
            display_name,
            category,
            description,
            r2_url,
            duration_seconds,
            default_gain
          )
        `)
        .eq('space_id', input.spaceId)
        .order('position', { ascending: true });

      if (error) throw error;
      return data ?? [];
    }),

  // Add SFX effect to a space
  addSpaceEffect: publicProcedure
    .input(z.object({
      spaceId: z.string().uuid(),
      sfxEffectId: z.string().uuid(),
      gain: z.number().min(0).max(1).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');

      // Verify user owns the space
      const { data: space } = await ctx.supabase
        .from('spaces')
        .select('id')
        .eq('id', input.spaceId)
        .eq('user_id', ctx.user.id)
        .maybeSingle();

      if (!space) throw new Error('Space not found or access denied');

      // Get the effect to check default gain
      const { data: effect } = await ctx.supabase
        .from('sfx_effects')
        .select('default_gain')
        .eq('id', input.sfxEffectId)
        .maybeSingle();

      if (!effect) throw new Error('SFX effect not found');

      // Get next position
      const { count } = await ctx.supabase
        .from('space_sfx')
        .select('id', { count: 'exact', head: true })
        .eq('space_id', input.spaceId);

      const { error } = await ctx.supabase
        .from('space_sfx')
        .insert({
          space_id: input.spaceId,
          sfx_effect_id: input.sfxEffectId,
          gain: input.gain ?? effect.default_gain,
          position: count ?? 0
        });

      if (error) throw error;
      return { success: true };
    }),

  // Update SFX effect settings for a space
  updateSpaceEffect: publicProcedure
    .input(z.object({
      spaceSfxId: z.string().uuid(),
      gain: z.number().min(0).max(1).optional(),
      position: z.number().min(0).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');

      // Verify user owns the space that contains this SFX
      const { data: spaceSfx } = await ctx.supabase
        .from('space_sfx')
        .select(`
          id,
          space_id,
          spaces!inner (user_id)
        `)
        .eq('id', input.spaceSfxId)
        .eq('spaces.user_id', ctx.user.id)
        .maybeSingle();

      if (!spaceSfx) throw new Error('SFX effect not found or access denied');

      const updateData: any = {};
      if (input.gain !== undefined) updateData.gain = input.gain;
      if (input.position !== undefined) updateData.position = input.position;

      const { error } = await ctx.supabase
        .from('space_sfx')
        .update(updateData)
        .eq('id', input.spaceSfxId);

      if (error) throw error;
      return { success: true };
    }),

  // Remove SFX effect from a space
  removeSpaceEffect: publicProcedure
    .input(z.object({ spaceSfxId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');

      // Verify user owns the space that contains this SFX
      const { data: spaceSfx } = await ctx.supabase
        .from('space_sfx')
        .select(`
          id,
          space_id,
          spaces!inner (user_id)
        `)
        .eq('id', input.spaceSfxId)
        .eq('spaces.user_id', ctx.user.id)
        .maybeSingle();

      if (!spaceSfx) throw new Error('SFX effect not found or access denied');

      const { error } = await ctx.supabase
        .from('space_sfx')
        .delete()
        .eq('id', input.spaceSfxId);

      if (error) throw error;
      return { success: true };
    }),

  // Reorder SFX effects for a space
  reorderSpaceEffects: publicProcedure
    .input(z.object({
      spaceId: z.string().uuid(),
      spaceSfxIds: z.array(z.string().uuid())
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');

      // Verify user owns the space
      const { data: space } = await ctx.supabase
        .from('spaces')
        .select('id')
        .eq('id', input.spaceId)
        .eq('user_id', ctx.user.id)
        .maybeSingle();

      if (!space) throw new Error('Space not found or access denied');

      // Update positions in transaction
      const updates = input.spaceSfxIds.map((spaceSfxId, index) => ({
        id: spaceSfxId,
        position: index
      }));

      for (const update of updates) {
        const { error } = await ctx.supabase
          .from('space_sfx')
          .update({ position: update.position })
          .eq('id', update.id)
          .eq('space_id', input.spaceId); // Extra security check

        if (error) throw error;
      }

      return { success: true };
    })
});
