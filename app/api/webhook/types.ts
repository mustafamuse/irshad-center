export interface StoredEventData {
  type: string
  objectId: string
  created: number
  processedAt: number
  metadata?: Record<string, unknown>
}

export interface LastEventData {
  eventId: string
  type: string
  timestamp: number
  objectId: string
  metadata?: Record<string, unknown>
}

export interface LogEventData {
  eventId: string
  type: string
  message?: string
  metadata?: Record<string, any>
  error?: string
  timestamp: number
  customerId?: string
  amount?: number
  status?: string
  subscriptionId?: string
  subscriptionStatus?: {
    status: 'pending' | 'processing' | 'completed' | 'failed'
    createdAt: string
    updatedAt: string
  }
  paymentMethodId?: string
  bankName?: string
  last4?: string
  source?: 'automated' | 'manual' | 'dashboard'
  attempts?: number
  maxRetries?: number
  attempt?: number
  delay?: number
  chunk_stats?: {
    chunkStart: number
    chunkEnd: number
    totalEvents: number
    missingEvents: number
    replayedEvents: number
    failedReplays: number
  }
  studentKey?: string
  total?: string
  retryCount?: number
}
