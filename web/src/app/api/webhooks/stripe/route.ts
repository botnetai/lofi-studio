import { NextResponse } from 'next/server';
import { verifyWebhook } from '@/server/lib/stripe';
import { getServerSupabaseClient } from '@/server/supabaseServer';
import type { Stripe } from 'stripe';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  let event: Stripe.Event;
  try {
    event = verifyWebhook(rawBody, sig);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = await getServerSupabaseClient();
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.userId || sub.metadata?.user_id || null;
        // Check if this is a subscription by checking for subscription-specific properties
        if (userId && 'current_period_end' in sub) {
          const subscription = sub as Stripe.Subscription;
          await supabase.from('user_subscriptions').upsert({
            user_id: userId,
            plan: 'pro',
            stripe_customer_id: subscription.customer as string,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
          });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.userId || sub.metadata?.user_id || null;
        if (userId) {
          await supabase.from('user_subscriptions').upsert({
            user_id: userId,
            plan: 'free',
            stripe_customer_id: sub.customer as string,
            stripe_subscription_id: sub.id,
            status: sub.status,
            current_period_end: null,
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}


