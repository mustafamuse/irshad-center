import { LinearClient } from '@linear/sdk'

import { env } from '@/lib/env'

let client: LinearClient | null = null

export function getLinearClient(): LinearClient {
  if (!client) {
    if (!env.LINEAR_API_KEY) {
      throw new Error('LINEAR_API_KEY is not configured')
    }
    client = new LinearClient({ apiKey: env.LINEAR_API_KEY })
  }
  return client
}

export function isLinearConfigured(): boolean {
  return !!(
    env.LINEAR_API_KEY &&
    env.LINEAR_TEAM_ID &&
    env.LINEAR_PAYMENT_LABEL_ID
  )
}
