import { LinearClient } from '@linear/sdk'

let client: LinearClient | null = null

export function getLinearClient(): LinearClient {
  if (!client) {
    const apiKey = process.env.LINEAR_API_KEY
    if (!apiKey) {
      throw new Error('LINEAR_API_KEY is not configured')
    }
    client = new LinearClient({ apiKey })
  }
  return client
}

export function isLinearConfigured(): boolean {
  return !!(
    process.env.LINEAR_API_KEY &&
    process.env.LINEAR_TEAM_ID &&
    process.env.LINEAR_PAYMENT_LABEL_ID
  )
}
