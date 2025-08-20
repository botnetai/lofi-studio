import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import type { FalModelType } from '@/lib/falModels';
import { IMAGE_MODEL_SCHEMAS, T2V_MODEL_SCHEMAS, I2V_MODEL_SCHEMAS } from '@/lib/falModels';

function getSchemasByType(type: FalModelType) {
  if (type === 'image') return IMAGE_MODEL_SCHEMAS;
  if (type === 'text2video') return T2V_MODEL_SCHEMAS;
  return I2V_MODEL_SCHEMAS;
}

export const modelsRouter = router({
  list: publicProcedure
    .input(z.object({ type: z.enum(['image', 'text2video', 'img2video']) }))
    .query(async ({ input }) => {
      const schemas = getSchemasByType(input.type);
      return schemas.map((s) => ({ id: s.id, label: s.label, type: s.type, description: s.description, recommended: s.recommended, disabled: s.disabled }));
    }),
  get: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const all = [...IMAGE_MODEL_SCHEMAS, ...T2V_MODEL_SCHEMAS, ...I2V_MODEL_SCHEMAS];
      const found = all.find((s) => s.id === input.id);
      if (!found) throw new Error('Model not found or disabled');
      return found;
    }),
});


