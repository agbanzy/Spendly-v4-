import Stripe from 'stripe';

let stripeClient: Stripe | null = null;
let publishableKey: string | null = null;

function getStripeConfig() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const pubKey = process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY;

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }

  return { secretKey, publishableKey: pubKey || '' };
}

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const { secretKey } = getStripeConfig();
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia' as any,
      maxNetworkRetries: 2,
      timeout: 30000,
    });
  }
  return stripeClient;
}

// Keep backward compatibility
export async function getUncachableStripeClient(): Promise<Stripe> {
  return getStripeClient();
}

export async function getStripePublishableKey(): Promise<string> {
  if (!publishableKey) {
    const config = getStripeConfig();
    publishableKey = config.publishableKey;
  }
  return publishableKey;
}


