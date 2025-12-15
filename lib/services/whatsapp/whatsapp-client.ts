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
 * @param phone - Phone number in any format
 * @returns Phone number in WhatsApp format (country code + number, no +)
 */
export function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '')

  // US numbers: 10 digits -> add country code
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
   * Make authenticated request to WhatsApp API
   */
  private async request<T>(endpoint: string, body: unknown): Promise<T> {
    const url = `${WHATSAPP_API_BASE_URL}/${this.apiVersion}/${this.phoneNumberId}${endpoint}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(
        `WhatsApp API error: ${response.status} - ${JSON.stringify(error)}`
      )
    }

    return response.json()
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
// FACTORY FUNCTION
// ============================================================================

/**
 * Create WhatsApp client from environment variables
 * Validates required configuration is present
 */
export function createWhatsAppClient(): WhatsAppClient {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      'Missing WhatsApp configuration: WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN are required'
    )
  }

  return new WhatsAppClient({ phoneNumberId, accessToken })
}
