import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { createCheckoutSession as stripeCreateCheckoutSession, createPortalSession, createCustomer } from '@/server/lib/stripe';

const PRICE_IDS = {
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
  pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
};

export const billingRouter = router({
  createCheckoutSession: publicProcedure
    .input(z.object({ plan: z.enum(['pro_monthly', 'pro_yearly']), successUrl: z.string().url().optional(), cancelUrl: z.string().url().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Unauthorized');
      const successUrl = input.successUrl ?? `${process.env.APP_ORIGIN}/account`;
      const cancelUrl = input.cancelUrl ?? `${process.env.APP_ORIGIN}/pricing`;
      // Read cached customer id from DB; create if missing
      const { data: existing } = await ctx.supabase.from('user_subscriptions').select('stripe_customer_id').eq('user_id', ctx.user.id).maybeSingle();
      let customerId = existing?.stripe_customer_id as string | undefined;
      if (!customerId) {
        customerId = await createCustomer(ctx.user.id, ctx.user.email);
        await ctx.supabase.from('user_subscriptions').upsert({ user_id: ctx.user.id, plan: 'free', stripe_customer_id: customerId });
      }
      const priceId = PRICE_IDS[input.plan];
      if (!priceId) throw new Error('Missing Stripe price id for plan');
      const url = await stripeCreateCheckoutSession({ customerId, priceId, successUrl, cancelUrl, userId: ctx.user.id });
      return { url };
    }),

  createPortalSession: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user) throw new Error('Unauthorized');
    const { data: existing } = await ctx.supabase.from('user_subscriptions').select('stripe_customer_id').eq('user_id', ctx.user.id).maybeSingle();
    let customerId = existing?.stripe_customer_id as string | undefined;
    if (!customerId) {
      customerId = await createCustomer(ctx.user.id, ctx.user.email);
      await ctx.supabase.from('user_subscriptions').upsert({ user_id: ctx.user.id, plan: 'free', stripe_customer_id: customerId });
    }
    const url = await createPortalSession(customerId, `${process.env.APP_ORIGIN}/account`);
    return { url };
  }),

  getSubscription: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new Error('Unauthorized');
    const { data } = await ctx.supabase.from('user_subscriptions').select('*').eq('user_id', ctx.user.id).maybeSingle();
    return data ?? { plan: 'free' };
  }),
});


