import { NextResponse } from 'next/server';
import { verifyWebhook } from '@/server/lib/stripe';
import { getServerSupabaseClient } from '@/server/supabaseServer';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  let event: any;
  try {
    event = verifyWebhook(rawBody, sig);
  } catch (e: any) {
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
        if (userId) {
          await supabase.from('user_subscriptions').upsert({
            user_id: userId,
            plan: 'pro',
            stripe_customer_id: sub.customer as string,
            stripe_subscription_id: sub.id,
            status: sub.status,
            current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
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


