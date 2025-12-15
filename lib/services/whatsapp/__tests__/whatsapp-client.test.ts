import crypto from 'node:crypto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  formatPhoneForWhatsApp,
  isValidPhoneNumber,
  verifyWebhookSignature,
  WhatsAppClient,
  createWhatsAppClient,
} from '../whatsapp-client'

describe('formatPhoneForWhatsApp', () => {
  it('should add country code 1 to 10-digit US phone', () => {
    expect(formatPhoneForWhatsApp('5551234567')).toBe('15551234567')
  })

  it('should strip non-numeric characters', () => {
    expect(formatPhoneForWhatsApp('(555) 123-4567')).toBe('15551234567')
    expect(formatPhoneForWhatsApp('+1 555 123 4567')).toBe('15551234567')
    expect(formatPhoneForWhatsApp('555.123.4567')).toBe('15551234567')
  })

  it('should pass through 11-digit numbers unchanged', () => {
    expect(formatPhoneForWhatsApp('15551234567')).toBe('15551234567')
  })

  it('should pass through international numbers (11-15 digits)', () => {
    expect(formatPhoneForWhatsApp('447911123456')).toBe('447911123456')
    expect(formatPhoneForWhatsApp('8615912345678')).toBe('8615912345678')
  })

  it('should throw for numbers less than 10 digits', () => {
    expect(() => formatPhoneForWhatsApp('555123456')).toThrow(
      'Invalid phone number format'
    )
    expect(() => formatPhoneForWhatsApp('12345')).toThrow(
      'Invalid phone number format'
    )
  })

  it('should throw for numbers more than 15 digits', () => {
    expect(() => formatPhoneForWhatsApp('1234567890123456')).toThrow(
      'Invalid phone number format'
    )
  })

  it('should handle empty string', () => {
    expect(() => formatPhoneForWhatsApp('')).toThrow(
      'Invalid phone number format'
    )
  })
})

describe('isValidPhoneNumber', () => {
  it('should return true for 10-digit phone', () => {
    expect(isValidPhoneNumber('5551234567')).toBe(true)
  })

  it('should return true for 11-digit phone (with country code)', () => {
    expect(isValidPhoneNumber('15551234567')).toBe(true)
  })

  it('should return true for international numbers (up to 15 digits)', () => {
    expect(isValidPhoneNumber('447911123456')).toBe(true)
    expect(isValidPhoneNumber('123456789012345')).toBe(true)
  })

  it('should return false for numbers less than 10 digits', () => {
    expect(isValidPhoneNumber('555123456')).toBe(false)
    expect(isValidPhoneNumber('12345')).toBe(false)
  })

  it('should return false for numbers more than 15 digits', () => {
    expect(isValidPhoneNumber('1234567890123456')).toBe(false)
  })

  it('should strip non-numeric characters before validation', () => {
    expect(isValidPhoneNumber('(555) 123-4567')).toBe(true)
    expect(isValidPhoneNumber('+1-555-123-4567')).toBe(true)
  })

  it('should return false for empty string', () => {
    expect(isValidPhoneNumber('')).toBe(false)
  })
})

describe('verifyWebhookSignature', () => {
  const appSecret = 'test-app-secret'
  const payload = '{"test": "payload"}'

  function generateValidSignature(body: string, secret: string): string {
    return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
  }

  it('should verify valid HMAC-SHA256 signature', () => {
    const signature = generateValidSignature(payload, appSecret)
    expect(verifyWebhookSignature(payload, signature, appSecret)).toBe(true)
  })

  it('should reject mismatched signature', () => {
    const wrongSignature = generateValidSignature(payload, 'wrong-secret')
    expect(verifyWebhookSignature(payload, wrongSignature, appSecret)).toBe(
      false
    )
  })

  it('should reject tampered payload', () => {
    const signature = generateValidSignature(payload, appSecret)
    expect(
      verifyWebhookSignature('{"tampered": true}', signature, appSecret)
    ).toBe(false)
  })

  it('should reject empty signature', () => {
    expect(verifyWebhookSignature(payload, '', appSecret)).toBe(false)
  })

  it('should reject empty secret', () => {
    const signature = generateValidSignature(payload, appSecret)
    expect(verifyWebhookSignature(payload, signature, '')).toBe(false)
  })

  it('should reject malformed signature (wrong length)', () => {
    expect(verifyWebhookSignature(payload, 'sha256=invalid', appSecret)).toBe(
      false
    )
  })

  it('should reject signature without sha256 prefix', () => {
    const hash = crypto
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest('hex')
    expect(verifyWebhookSignature(payload, hash, appSecret)).toBe(false)
  })
})

describe('WhatsAppClient', () => {
  const mockConfig = {
    phoneNumberId: 'test-phone-id',
    accessToken: 'test-access-token',
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should construct with required config', () => {
    const client = new WhatsAppClient(mockConfig)
    expect(client).toBeDefined()
  })

  it('should use default API version if not provided', () => {
    const client = new WhatsAppClient(mockConfig)
    expect(client).toBeDefined()
  })

  it('should use custom API version if provided', () => {
    const client = new WhatsAppClient({
      ...mockConfig,
      apiVersion: 'v20.0',
    })
    expect(client).toBeDefined()
  })

  describe('sendTemplate', () => {
    it('should make correct API request', async () => {
      const mockResponse = {
        messaging_product: 'whatsapp',
        contacts: [{ input: '15551234567', wa_id: '15551234567' }],
        messages: [{ id: 'wamid.test123' }],
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const client = new WhatsAppClient(mockConfig)
      const result = await client.sendTemplate(
        '15551234567',
        'test_template',
        'en',
        ['param1', 'param2']
      )

      expect(result).toEqual(mockResponse)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('should include button parameters for dynamic URLs', async () => {
      const mockResponse = {
        messaging_product: 'whatsapp',
        contacts: [{ input: '15551234567', wa_id: '15551234567' }],
        messages: [{ id: 'wamid.test123' }],
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const client = new WhatsAppClient(mockConfig)
      await client.sendTemplate(
        '15551234567',
        'payment_link',
        'en',
        ['John', '$160.00', '3'],
        ['cs_test_session_id']
      )

      const fetchCall = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(fetchCall[1]?.body as string)

      expect(body.template.components).toContainEqual(
        expect.objectContaining({
          type: 'button',
          sub_type: 'url',
          index: 0,
          parameters: [{ type: 'text', text: 'cs_test_session_id' }],
        })
      )
    })

    it('should throw on API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: { message: 'Invalid phone' } }),
      })

      const client = new WhatsAppClient(mockConfig)

      await expect(
        client.sendTemplate('invalid', 'test_template')
      ).rejects.toThrow('WhatsApp API error: 400')
    })
  })

  describe('sendMessage', () => {
    it('should send text message', async () => {
      const mockResponse = {
        messaging_product: 'whatsapp',
        contacts: [{ input: '15551234567', wa_id: '15551234567' }],
        messages: [{ id: 'wamid.test123' }],
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const client = new WhatsAppClient(mockConfig)
      const result = await client.sendMessage('15551234567', 'Hello!')

      expect(result).toEqual(mockResponse)

      const fetchCall = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(fetchCall[1]?.body as string)

      expect(body.type).toBe('text')
      expect(body.text.body).toBe('Hello!')
    })
  })
})

describe('createWhatsAppClient', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should throw when WHATSAPP_PHONE_NUMBER_ID is missing', () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = ''
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token'

    expect(() => createWhatsAppClient()).toThrow(
      'Missing WhatsApp configuration'
    )
  })

  it('should throw when WHATSAPP_ACCESS_TOKEN is missing', () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-id'
    process.env.WHATSAPP_ACCESS_TOKEN = ''

    expect(() => createWhatsAppClient()).toThrow(
      'Missing WhatsApp configuration'
    )
  })

  it('should create client when env vars are present', () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-id'
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token'

    const client = createWhatsAppClient()
    expect(client).toBeInstanceOf(WhatsAppClient)
  })
})
