import crypto from 'node:crypto'

import {
  WHATSAPP_API_BASE_URL,
  WHATSAPP_API_VERSION,
} from '@/lib/constants/whatsapp'

// ============================================================================
// TYPE DEFINITIONS (from Midday's pattern)
// ============================================================================

export interface WhatsAppClientConfig {
  phoneNumberId: string
  accessToken: string
  apiVersion?: string
}

export interface WhatsAppWebhookPayload {
  object: string
  entry: WhatsAppEntry[]
}

export interface WhatsAppEntry {
  id: string
  changes: WhatsAppChange[]
}

export interface WhatsAppChange {
  value: WhatsAppValue
  field: string
}

export interface WhatsAppValue {
  messaging_product: string
  metadata: {
    display_phone_number: string
    phone_number_id: string
  }
  contacts?: WhatsAppContact[]
  messages?: WhatsAppMessage[]
  statuses?: WhatsAppStatus[]
}

export interface WhatsAppContact {
  profile: {
    name: string
  }
  wa_id: string
}

export interface WhatsAppMessage {
  from: string
  id: string
  timestamp: string
  type: 'text' | 'image' | 'document' | 'interactive' | 'audio' | 'video'
  text?: {
    body: string
  }
  interactive?: {
    type: string
    button_reply?: {
      id: string
      title: string
    }
  }
}

export interface WhatsAppStatus {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
  errors?: Array<{ title: string; code: number; message?: string }>
}

export interface SendMessageResponse {
  messaging_product: string
  contacts: Array<{ input: string; wa_id: string }>
  messages: Array<{ id: string }>
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button'
  sub_type?: 'url' | 'quick_reply'
  index?: number
  parameters: Array<{ type: 'text'; text: string }>
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format phone number for WhatsApp API
 * WhatsApp requires E.164 format without the + prefix
 *
 * NOTE: This function assumes US numbers for 10-digit inputs (adds country code 1).
 * For international support, consider using libphonenumber-js library.
 *
 * @param phone - Phone number in any format
 * @returns Phone number in WhatsApp format (country code + number, no +)
 * @throws Error if phone number length is invalid (<10 or >15 digits)
 */
export function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '')

  // US numbers: 10 digits -> add country code 1
  if (digits.length === 10) {
    return `1${digits}`
  }

  // Already has country code (11-15 digits)
  if (digits.length >= 11 && digits.length <= 15) {
    return digits
  }

  throw new Error(`Invalid phone number format: ${phone}`)
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

/**
 * Verify webhook signature from Meta
 * Uses HMAC SHA256 with timing-safe comparison
 * @param payload - Raw request body as string
 * @param signature - X-Hub-Signature-256 header value
 * @param appSecret - WhatsApp app secret
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string
): boolean {
  if (!signature || !appSecret) {
    return false
  }

  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(payload).digest('hex')}`

  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(signature)

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
}

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1000

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// WHATSAPP CLIENT CLASS (based on Midday's pattern)
// ============================================================================

export class WhatsAppClient {
  private phoneNumberId: string
  private accessToken: string
  private apiVersion: string

  constructor(config: WhatsAppClientConfig) {
    this.phoneNumberId = config.phoneNumberId
    this.accessToken = config.accessToken
    this.apiVersion = config.apiVersion || WHATSAPP_API_VERSION
  }

  /**
   * Make authenticated request to WhatsApp API with exponential backoff retry
   * Retries on 5xx errors and 429 (rate limit) with exponential backoff
   */
  private async request<T>(
    endpoint: string,
    body: unknown,
    retries = MAX_RETRIES
  ): Promise<T> {
    const url = `${WHATSAPP_API_BASE_URL}/${this.apiVersion}/${this.phoneNumberId}${endpoint}`

    for (let attempt = 0; attempt <= retries; attempt++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        return response.json()
      }

      const errorBody = await response.json().catch(() => ({}))
      const isRetryable = isRetryableStatus(response.status)
      const hasRetriesLeft = attempt < retries

      if (isRetryable && hasRetriesLeft) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt)
        await sleep(delay)
        continue
      }

      throw new Error(
        `WhatsApp API error: ${response.status} - ${JSON.stringify(errorBody)}`
      )
    }

    throw new Error('Unexpected error in request retry loop')
  }

  /**
   * Send a template message (required for business-initiated messages)
   * Templates must be pre-approved by Meta
   *
   * @param to - Phone number in E.164 format without +
   * @param templateName - Approved template name
   * @param languageCode - Language code (default: "en")
   * @param bodyParams - Body parameters ({{1}}, {{2}}, etc.)
   * @param buttonParams - Button URL parameters (for dynamic URLs)
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string = 'en',
    bodyParams: string[] = [],
    buttonParams?: string[]
  ): Promise<SendMessageResponse> {
    const components: TemplateComponent[] = []

    // Body parameters ({{1}}, {{2}}, etc.)
    if (bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParams.map((p) => ({ type: 'text', text: p })),
      })
    }

    // Button URL parameters (for dynamic payment links)
    if (buttonParams && buttonParams.length > 0) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: 0,
        parameters: buttonParams.map((p) => ({ type: 'text', text: p })),
      })
    }

    return this.request<SendMessageResponse>('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components.length > 0 ? components : undefined,
      },
    })
  }

  /**
   * Send a free-form text message
   * Only works within 24-hour customer service window (after user messages first)
   */
  async sendMessage(to: string, text: string): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text },
    })
  }

  /**
   * Send interactive message with buttons
   * Only works within 24-hour customer service window
   */
  async sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map((button) => ({
            type: 'reply',
            reply: { id: button.id, title: button.title },
          })),
        },
      },
    })
  }

  /**
   * React to a message with an emoji
   */
  async reactToMessage(
    to: string,
    messageId: string,
    emoji: string
  ): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'reaction',
      reaction: {
        message_id: messageId,
        emoji,
      },
    })
  }

  /**
   * Remove reaction from a message
   */
  async removeReaction(
    to: string,
    messageId: string
  ): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'reaction',
      reaction: {
        message_id: messageId,
        emoji: '', // Empty string removes reaction
      },
    })
  }
}

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

const REQUIRED_ENV_VARS = [
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
] as const

const WEBHOOK_ENV_VARS = [
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
] as const

export interface WhatsAppEnvValidationResult {
  valid: boolean
  missing: string[]
}

/**
 * Validate WhatsApp environment variables
 * Call at startup or in middleware to catch configuration issues early
 * @param includeWebhook - Also validate webhook-related env vars
 */
export function validateWhatsAppEnv(
  includeWebhook = false
): WhatsAppEnvValidationResult {
  const requiredVars = includeWebhook
    ? [...REQUIRED_ENV_VARS, ...WEBHOOK_ENV_VARS]
    : [...REQUIRED_ENV_VARS]

  const missing = requiredVars.filter((key) => !process.env[key])

  return {
    valid: missing.length === 0,
    missing,
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create WhatsApp client from environment variables
 * Validates required configuration is present
 */
export function createWhatsAppClient(): WhatsAppClient {
  const validation = validateWhatsAppEnv()
  if (!validation.valid) {
    throw new Error(
      `Missing WhatsApp configuration: ${validation.missing.join(', ')}`
    )
  }

  return new WhatsAppClient({
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  })
}
