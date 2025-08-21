import Stripe from 'stripe';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export function getStripe() {
  const key = requireEnv('STRIPE_SECRET_KEY');
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

export async function createCustomer(userId: string, email?: string | null) {
  const stripe = getStripe();
  const customer = await stripe.customers.create({ email: email ?? undefined, metadata: { userId } });
  return customer.id;
}

export async function createCheckoutSession(params: { customerId: string; priceId: string; successUrl: string; cancelUrl: string; userId: string }) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: params.customerId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { userId: params.userId },
    subscription_data: { metadata: { userId: params.userId } },
  });
  return session.url!;
}

export async function createPortalSession(customerId: string, returnUrl: string) {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return session.url;
}

export function verifyWebhook(rawBody: string, signature: string) {
  const stripe = getStripe();
  const secret = requireEnv('STRIPE_WEBHOOK_SECRET');
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}


