import {
  Program,
  WhatsAppMessageType,
  WhatsAppRecipientType,
} from '@prisma/client'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockFindMany, mockFindUnique, mockUpdate, mockCount, mockGroupBy } =
  vi.hoisted(() => ({
    mockFindMany: vi.fn(),
    mockFindUnique: vi.fn(),
    mockUpdate: vi.fn(),
    mockCount: vi.fn(),
    mockGroupBy: vi.fn(),
  }))

vi.mock('@/lib/db', () => ({
  prisma: {
    whatsAppMessage: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
      count: mockCount,
      groupBy: mockGroupBy,
    },
  },
}))

import {
  getWhatsAppMessages,
  getWhatsAppMessageByWaId,
  getWhatsAppMessageById,
  getFailedMessages,
  getMessageCountByStatus,
  updateMessageStatus,
  getMessagesByFamily,
  getMessagesByPerson,
  getRecentMessagesToPhone,
  hasRecentMessage,
} from '../whatsapp'

describe('getWhatsAppMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return messages with default options', async () => {
    const mockMessages = [{ id: 'msg-1', phoneNumber: '5551234567' }]
    mockFindMany.mockResolvedValue(mockMessages)

    const result = await getWhatsAppMessages()

    expect(result).toEqual(mockMessages)
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
      take: 50,
      skip: 0,
      include: {
        person: {
          select: { id: true, name: true },
        },
      },
    })
  })

  it('should filter by program', async () => {
    mockFindMany.mockResolvedValue([])

    await getWhatsAppMessages({ program: Program.DUGSI_PROGRAM })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { program: Program.DUGSI_PROGRAM },
      })
    )
  })

  it('should filter by recipientType', async () => {
    mockFindMany.mockResolvedValue([])

    await getWhatsAppMessages({ recipientType: WhatsAppRecipientType.PARENT })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientType: WhatsAppRecipientType.PARENT },
      })
    )
  })

  it('should filter by messageType', async () => {
    mockFindMany.mockResolvedValue([])

    await getWhatsAppMessages({
      messageType: WhatsAppMessageType.TRANSACTIONAL,
    })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { messageType: WhatsAppMessageType.TRANSACTIONAL },
      })
    )
  })

  it('should filter by status', async () => {
    mockFindMany.mockResolvedValue([])

    await getWhatsAppMessages({ status: 'failed' })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'failed' },
      })
    )
  })

  it('should filter by date range', async () => {
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-01-31')
    mockFindMany.mockResolvedValue([])

    await getWhatsAppMessages({ startDate, endDate })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      })
    )
  })

  it('should apply pagination', async () => {
    mockFindMany.mockResolvedValue([])

    await getWhatsAppMessages({}, { limit: 10, offset: 20 })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 20,
      })
    )
  })
})

describe('getWhatsAppMessageByWaId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should find message by WhatsApp message ID', async () => {
    const mockMessage = { id: 'msg-1', waMessageId: 'wamid.test123' }
    mockFindUnique.mockResolvedValue(mockMessage)

    const result = await getWhatsAppMessageByWaId('wamid.test123')

    expect(result).toEqual(mockMessage)
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { waMessageId: 'wamid.test123' },
    })
  })

  it('should return null for non-existent ID', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await getWhatsAppMessageByWaId('non-existent')

    expect(result).toBeNull()
  })
})

describe('getWhatsAppMessageById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should find message by internal ID with person included', async () => {
    const mockMessage = {
      id: 'msg-1',
      person: { id: 'person-1', name: 'John' },
    }
    mockFindUnique.mockResolvedValue(mockMessage)

    const result = await getWhatsAppMessageById('msg-1')

    expect(result).toEqual(mockMessage)
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      include: {
        person: {
          select: { id: true, name: true },
        },
      },
    })
  })
})

describe('getFailedMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call getWhatsAppMessages with status=failed', async () => {
    mockFindMany.mockResolvedValue([])

    await getFailedMessages({ program: Program.DUGSI_PROGRAM })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'failed',
          program: Program.DUGSI_PROGRAM,
        }),
      })
    )
  })
})

describe('getMessageCountByStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return counts grouped by status', async () => {
    mockGroupBy.mockResolvedValue([
      { status: 'sent', _count: { status: 10 } },
      { status: 'delivered', _count: { status: 8 } },
      { status: 'failed', _count: { status: 2 } },
    ])

    const result = await getMessageCountByStatus()

    expect(result).toEqual({
      sent: 10,
      delivered: 8,
      failed: 2,
    })
  })

  it('should filter by program', async () => {
    mockGroupBy.mockResolvedValue([])

    await getMessageCountByStatus({ program: Program.DUGSI_PROGRAM })

    expect(mockGroupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: { program: Program.DUGSI_PROGRAM },
      _count: { status: true },
    })
  })
})

describe('updateMessageStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update status', async () => {
    mockUpdate.mockResolvedValue({ id: 'msg-1', status: 'delivered' })

    await updateMessageStatus('wamid.test', 'delivered')

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { waMessageId: 'wamid.test' },
      data: { status: 'delivered' },
    })
  })

  it('should set failedAt when status is failed', async () => {
    mockUpdate.mockResolvedValue({ id: 'msg-1', status: 'failed' })

    await updateMessageStatus('wamid.test', 'failed', 'Rate limit exceeded')

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { waMessageId: 'wamid.test' },
      data: {
        status: 'failed',
        failedAt: expect.any(Date),
        failureReason: 'Rate limit exceeded',
      },
    })
  })

  it('should not set failureReason if not provided', async () => {
    mockUpdate.mockResolvedValue({ id: 'msg-1', status: 'failed' })

    await updateMessageStatus('wamid.test', 'failed')

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { waMessageId: 'wamid.test' },
      data: {
        status: 'failed',
        failedAt: expect.any(Date),
      },
    })
  })
})

describe('getMessagesByFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should filter by familyId', async () => {
    mockFindMany.mockResolvedValue([])

    await getMessagesByFamily('family-123')

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyId: 'family-123' },
      })
    )
  })
})

describe('getMessagesByPerson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should filter by personId', async () => {
    mockFindMany.mockResolvedValue([])

    await getMessagesByPerson('person-123')

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { personId: 'person-123' },
      })
    )
  })
})

describe('getRecentMessagesToPhone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should find messages within specified hours', async () => {
    mockFindMany.mockResolvedValue([])

    const now = new Date()
    vi.useFakeTimers()
    vi.setSystemTime(now)

    await getRecentMessagesToPhone('5551234567', 24)

    const expectedCutoff = new Date(now)
    expectedCutoff.setHours(expectedCutoff.getHours() - 24)

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        phoneNumber: '5551234567',
        createdAt: { gte: expect.any(Date) },
      },
      orderBy: { createdAt: 'desc' },
    })

    vi.useRealTimers()
  })

  it('should default to 24 hours', async () => {
    mockFindMany.mockResolvedValue([])

    await getRecentMessagesToPhone('5551234567')

    expect(mockFindMany).toHaveBeenCalled()
  })
})

describe('hasRecentMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return true when matching message exists', async () => {
    mockCount.mockResolvedValue(1)

    const result = await hasRecentMessage(
      '5551234567',
      'dugsi_payment_link',
      24
    )

    expect(result).toBe(true)
  })

  it('should return false when no matching message exists', async () => {
    mockCount.mockResolvedValue(0)

    const result = await hasRecentMessage(
      '5551234567',
      'dugsi_payment_link',
      24
    )

    expect(result).toBe(false)
  })

  it('should filter by phone, template, time, and sent status', async () => {
    mockCount.mockResolvedValue(0)

    await hasRecentMessage('5551234567', 'dugsi_payment_link', 12)

    expect(mockCount).toHaveBeenCalledWith({
      where: {
        phoneNumber: '5551234567',
        templateName: 'dugsi_payment_link',
        createdAt: { gte: expect.any(Date) },
        status: 'sent',
      },
    })
  })
})
