import {
  Program,
  WhatsAppMessageType,
  WhatsAppRecipientType,
} from '@prisma/client'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockSendTemplate, mockCreate, mockHasRecentMessage } = vi.hoisted(
  () => ({
    mockSendTemplate: vi.fn(),
    mockCreate: vi.fn(),
    mockHasRecentMessage: vi.fn(),
  })
)

vi.mock('../whatsapp-client', () => ({
  createWhatsAppClient: vi.fn(() => ({
    sendTemplate: mockSendTemplate,
  })),
  formatPhoneForWhatsApp: vi.fn((phone: string) => {
    const digits = phone.replace(/\D/g, '')
    return digits.length === 10 ? `1${digits}` : digits
  }),
  isValidPhoneNumber: vi.fn((phone: string) => {
    const digits = phone.replace(/\D/g, '')
    return digits.length >= 10 && digits.length <= 15
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    whatsAppMessage: {
      create: mockCreate,
    },
  },
}))

vi.mock('@/lib/db/queries/whatsapp', () => ({
  hasRecentMessage: mockHasRecentMessage,
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logError: vi.fn(),
  logWarning: vi.fn(),
}))

import {
  formatCurrency,
  formatDate,
  sendPaymentLink,
  sendPaymentConfirmation,
  sendPaymentReminder,
} from '../whatsapp-service'

describe('formatCurrency', () => {
  it('should format cents to USD string', () => {
    expect(formatCurrency(16000)).toBe('$160.00')
    expect(formatCurrency(10000)).toBe('$100.00')
    expect(formatCurrency(2550)).toBe('$25.50')
  })

  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('should handle large amounts', () => {
    expect(formatCurrency(100000)).toBe('$1,000.00')
    expect(formatCurrency(1000000)).toBe('$10,000.00')
  })

  it('should use specified currency', () => {
    expect(formatCurrency(10000, 'EUR')).toBe('€100.00')
    expect(formatCurrency(10000, 'GBP')).toBe('£100.00')
  })
})

describe('formatDate', () => {
  it('should format date to readable string', () => {
    const date = new Date(2025, 11, 14)
    expect(formatDate(date)).toBe('Dec 14, 2025')
  })

  it('should format different months correctly', () => {
    expect(formatDate(new Date(2025, 0, 1))).toBe('Jan 1, 2025')
    expect(formatDate(new Date(2025, 5, 15))).toBe('Jun 15, 2025')
  })
})

describe('sendPaymentLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasRecentMessage.mockResolvedValue(false)
  })

  const validInput = {
    phone: '5551234567',
    parentName: 'John Doe',
    amount: 16000,
    childCount: 3,
    paymentUrl: 'https://checkout.stripe.com/c/pay/cs_test_abc123xyz',
    program: Program.DUGSI_PROGRAM,
    personId: 'person-123',
    familyId: 'family-123',
  }

  it('should return error for invalid phone number', async () => {
    const { isValidPhoneNumber } = await import('../whatsapp-client')
    vi.mocked(isValidPhoneNumber).mockReturnValue(false)

    const result = await sendPaymentLink({
      ...validInput,
      phone: '123',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid phone number format')
    expect(mockSendTemplate).not.toHaveBeenCalled()
  })

  it('should return error for duplicate message within 1 hour', async () => {
    const { isValidPhoneNumber } = await import('../whatsapp-client')
    vi.mocked(isValidPhoneNumber).mockReturnValue(true)
    mockHasRecentMessage.mockResolvedValue(true)

    const result = await sendPaymentLink(validInput)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Message already sent within the last hour')
    expect(mockSendTemplate).not.toHaveBeenCalled()
  })

  it('should return error for invalid payment URL without session ID', async () => {
    const { isValidPhoneNumber } = await import('../whatsapp-client')
    vi.mocked(isValidPhoneNumber).mockReturnValue(true)

    const result = await sendPaymentLink({
      ...validInput,
      paymentUrl: 'https://example.com/invalid-url',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid payment URL format')
    expect(mockSendTemplate).not.toHaveBeenCalled()
  })

  it('should send template with correct parameters', async () => {
    const { isValidPhoneNumber } = await import('../whatsapp-client')
    vi.mocked(isValidPhoneNumber).mockReturnValue(true)

    mockSendTemplate.mockResolvedValue({
      messaging_product: 'whatsapp',
      contacts: [{ input: '15551234567', wa_id: '15551234567' }],
      messages: [{ id: 'wamid.test123' }],
    })

    mockCreate.mockResolvedValue({})

    const result = await sendPaymentLink(validInput)

    expect(result.success).toBe(true)
    expect(result.waMessageId).toBe('wamid.test123')

    expect(mockSendTemplate).toHaveBeenCalledWith(
      '15551234567',
      'dugsi_payment_link',
      'en',
      ['John', '$160.00', '3'],
      ['cs_test_abc123xyz']
    )
  })

  it('should extract session ID from Stripe URL', async () => {
    const { isValidPhoneNumber } = await import('../whatsapp-client')
    vi.mocked(isValidPhoneNumber).mockReturnValue(true)

    mockSendTemplate.mockResolvedValue({
      messages: [{ id: 'wamid.test' }],
    })

    mockCreate.mockResolvedValue({})

    await sendPaymentLink({
      ...validInput,
      paymentUrl: 'https://checkout.stripe.com/c/pay/cs_live_abc123',
    })

    expect(mockSendTemplate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'en',
      expect.anything(),
      ['cs_live_abc123']
    )
  })

  it('should create WhatsAppMessage record with normalized phone on success', async () => {
    const { isValidPhoneNumber } = await import('../whatsapp-client')
    vi.mocked(isValidPhoneNumber).mockReturnValue(true)

    mockSendTemplate.mockResolvedValue({
      messages: [{ id: 'wamid.success' }],
    })

    mockCreate.mockResolvedValue({})

    await sendPaymentLink(validInput)

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        waMessageId: 'wamid.success',
        phoneNumber: '15551234567',
        templateName: 'dugsi_payment_link',
        program: Program.DUGSI_PROGRAM,
        recipientType: WhatsAppRecipientType.PARENT,
        personId: 'person-123',
        familyId: 'family-123',
        messageType: WhatsAppMessageType.TRANSACTIONAL,
        status: 'sent',
      }),
    })
  })

  it('should create failed WhatsAppMessage record on error', async () => {
    const { isValidPhoneNumber } = await import('../whatsapp-client')
    vi.mocked(isValidPhoneNumber).mockReturnValue(true)

    mockSendTemplate.mockRejectedValue(new Error('API rate limit exceeded'))
    mockCreate.mockResolvedValue({})

    const result = await sendPaymentLink(validInput)

    expect(result.success).toBe(false)
    expect(result.error).toBe('API rate limit exceeded')

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'failed',
        failureReason: 'API rate limit exceeded',
      }),
    })
  })

  it('should use first name only for template', async () => {
    const { isValidPhoneNumber } = await import('../whatsapp-client')
    vi.mocked(isValidPhoneNumber).mockReturnValue(true)

    mockSendTemplate.mockResolvedValue({
      messages: [{ id: 'wamid.test' }],
    })

    mockCreate.mockResolvedValue({})

    await sendPaymentLink({
      ...validInput,
      parentName: 'Ahmed Mohamed Hassan',
    })

    expect(mockSendTemplate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'en',
      ['Ahmed', expect.anything(), expect.anything()],
      expect.anything()
    )
  })
})

describe('sendPaymentConfirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasRecentMessage.mockResolvedValue(false)
  })

  const validInput = {
    phone: '5551234567',
    parentName: 'John Doe',
    amount: 16000,
    nextPaymentDate: new Date(2025, 0, 14),
    studentNames: ['Child 1', 'Child 2'],
    program: Program.DUGSI_PROGRAM,
    personId: 'person-123',
    familyId: 'family-123',
  }

  it('should send confirmation with student names joined', async () => {
    const { isValidPhoneNumber } = await import('../whatsapp-client')
    vi.mocked(isValidPhoneNumber).mockReturnValue(true)

    mockSendTemplate.mockResolvedValue({
      messages: [{ id: 'wamid.conf' }],
    })

    mockCreate.mockResolvedValue({})

    const result = await sendPaymentConfirmation(validInput)

    expect(result.success).toBe(true)
    expect(mockSendTemplate).toHaveBeenCalledWith(
      '15551234567',
      'dugsi_payment_confirmed',
      'en',
      ['John', '$160.00', 'Jan 14, 2025', 'Child 1, Child 2']
    )
  })

  it('should create NOTIFICATION type message', async () => {
    const { isValidPhoneNumber } = await import('../whatsapp-client')
    vi.mocked(isValidPhoneNumber).mockReturnValue(true)

    mockSendTemplate.mockResolvedValue({
      messages: [{ id: 'wamid.conf' }],
    })

    mockCreate.mockResolvedValue({})

    await sendPaymentConfirmation(validInput)

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        messageType: WhatsAppMessageType.NOTIFICATION,
      }),
    })
  })
})

describe('sendPaymentReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasRecentMessage.mockResolvedValue(false)
  })

  const validInput = {
    phone: '5551234567',
    parentName: 'John Doe',
    amount: 16000,
    dueDate: new Date(2025, 0, 14),
    billingUrl: 'https://irshad.center/billing/account-123',
    program: Program.DUGSI_PROGRAM,
    personId: 'person-123',
    familyId: 'family-123',
  }

  it('should send reminder with billing URL suffix', async () => {
    const { isValidPhoneNumber } = await import('../whatsapp-client')
    vi.mocked(isValidPhoneNumber).mockReturnValue(true)

    mockSendTemplate.mockResolvedValue({
      messages: [{ id: 'wamid.reminder' }],
    })

    mockCreate.mockResolvedValue({})

    const result = await sendPaymentReminder(validInput)

    expect(result.success).toBe(true)
    expect(mockSendTemplate).toHaveBeenCalledWith(
      '15551234567',
      'dugsi_payment_reminder',
      'en',
      ['John', '$160.00', 'Jan 14, 2025'],
      ['account-123']
    )
  })

  it('should create REMINDER type message', async () => {
    const { isValidPhoneNumber } = await import('../whatsapp-client')
    vi.mocked(isValidPhoneNumber).mockReturnValue(true)

    mockSendTemplate.mockResolvedValue({
      messages: [{ id: 'wamid.reminder' }],
    })

    mockCreate.mockResolvedValue({})

    await sendPaymentReminder(validInput)

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        messageType: WhatsAppMessageType.REMINDER,
      }),
    })
  })
})
