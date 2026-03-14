/**
 * One-time script to create the Zakat al-Fitr product in Stripe.
 *
 * Usage:
 *   npx tsx -r dotenv/config scripts/create-zakat-fitr-product.ts dotenv_config_path=.env.local
 *
 * After running, add the output product ID to your .env.local:
 *   STRIPE_ZAKAT_FITR_PRODUCT_ID=prod_xxx
 */

import { getDonationStripeClient } from '@/lib/stripe-donation'

async function main() {
  const stripe = getDonationStripeClient()

  const existing = await stripe.products.list({ active: true, limit: 100 })
  const found = existing.data.find((p) => p.name === 'Zakat al-Fitr')

  if (found) {
    console.log(`Product already exists: ${found.id}`)
    console.log(
      `\nAdd to .env.local:\nSTRIPE_ZAKAT_FITR_PRODUCT_ID=${found.id}`
    )
    return
  }

  const product = await stripe.products.create({
    name: 'Zakat al-Fitr',
    description: 'Annual Zakat al-Fitr obligation — $13 per person',
  })

  console.log(`Created product: ${product.id}`)
  console.log(
    `\nAdd to .env.local:\nSTRIPE_ZAKAT_FITR_PRODUCT_ID=${product.id}`
  )
}

main().catch(console.error)
