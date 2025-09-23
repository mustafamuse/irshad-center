import Stripe from 'stripe'
let stripeClient: Stripe | null = null
// Get configured server-side Stripe client
export function getStripeClient(): Stripe {
  const stripeKey =
    process.env.NODE_ENV === 'production'
      ? process.env.STRIPE_SECRET_KEY_PROD
      : process.env.STRIPE_SECRET_KEY_DEV

  // Add debug logging
  console.log('Current NODE_ENV:', process.env.NODE_ENV)
  console.log(
    'Using key type:',
    process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV'
  )

  if (!stripeKey) {
    throw new Error(
      'Stripe secret key is not defined. Please set STRIPE_SECRET_KEY_DEV and STRIPE_SECRET_KEY_PROD in your environment variables.'
    )
  }

  if (!stripeClient) {
    console.log('Initializing Stripe client...')
    stripeClient = new Stripe(stripeKey, {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    })
  }
  return stripeClient
}

// Export a proxy object that lazily initializes the client
export const stripeServerClient = new Proxy({} as Stripe, {
  get: (target, prop) => {
    const client = getStripeClient()
    const value = client[prop as keyof Stripe]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})

// Optional: Test initialization during app startup
export async function testStripeClientInitialization(): Promise<void> {
  try {
    const client = getStripeClient()
    await client.customers.list({ limit: 1 })
    console.log('Stripe client initialized successfully.')
  } catch (error) {
    console.error('Stripe client initialization failed:', error)
  }
}
