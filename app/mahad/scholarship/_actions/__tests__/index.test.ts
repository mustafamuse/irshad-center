import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGeneratePDF,
  mockFormatPDFData,
  mockRender,
  mockSendEmail,
  mockSendConfirmationEmail,
  mockLogError,
  mockLogWarning,
  mockCheckRateLimit,
  mockHeaders,
} = vi.hoisted(() => ({
  mockGeneratePDF: vi.fn(),
  mockFormatPDFData: vi.fn(),
  mockRender: vi.fn(),
  mockSendEmail: vi.fn(),
  mockSendConfirmationEmail: vi.fn(),
  mockLogError: vi.fn(),
  mockLogWarning: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockHeaders: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}))

vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

vi.mock('@react-email/components', () => ({
  render: (...args: unknown[]) => mockRender(...args),
}))

vi.mock('@/lib/email/email-service', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  sendConfirmationEmail: (...args: unknown[]) =>
    mockSendConfirmationEmail(...args),
  EMAIL_CONFIG: { adminEmail: 'admin@example.com' },
}))

vi.mock('../../_lib/format-data', () => ({
  formatPDFData: (...args: unknown[]) => mockFormatPDFData(...args),
}))

vi.mock('../../_lib/generate-pdf', () => ({
  generateScholarshipPDF: (...args: unknown[]) => mockGeneratePDF(...args),
}))

vi.mock('../../_templates/email/scholarship', () => ({
  ScholarshipApplicationEmail: () => null,
}))

vi.mock('@/lib/logger', () => ({
  createActionLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logError: (...args: unknown[]) => mockLogError(...args),
  logWarning: (...args: unknown[]) => mockLogWarning(...args),
}))

vi.mock('@/lib/safe-action', () => ({
  rateLimitedActionClient: {
    metadata: (meta: { actionName: string; maxAttempts?: number }) => ({
      schema: (schema: {
        safeParse: (input: unknown) => {
          success: boolean
          data?: unknown
          error?: { flatten: () => { fieldErrors: Record<string, string[]> } }
        }
      }) => ({
        action:
          (handler: (opts: { parsedInput: unknown }) => Promise<unknown>) =>
          async (input: unknown) => {
            const h = await mockHeaders()
            const ip =
              h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
            const rateResult = await mockCheckRateLimit(
              `${meta.actionName}:${ip}`,
              meta.maxAttempts,
              { failClosed: true }
            )
            if (!rateResult.success) {
              return {
                serverError: 'Too many attempts. Please try again later.',
              }
            }
            const parsed = schema.safeParse(input)
            if (!parsed.success) {
              return { validationErrors: parsed.error!.flatten().fieldErrors }
            }
            try {
              return { data: await handler({ parsedInput: parsed.data }) }
            } catch (e) {
              if (e instanceof Error && 'code' in e) {
                return { serverError: e.message }
              }
              return { serverError: 'Something went wrong' }
            }
          },
      }),
    }),
  },
}))

import { submitScholarshipApplication } from '../index'

const VALID_INPUT = {
  studentName: 'Test Student',
  className: 'Batch 3',
  email: 'student@example.com',
  phone: '6125551234',
  payer: 'self' as const,
  educationStatus: 'not-studying' as const,
  householdSize: '4',
  dependents: '2',
  adultsInHousehold: '2',
  livesWithBothParents: 'yes' as const,
  isEmployed: 'no' as const,
  monthlyIncome: null,
  needJustification: 'n'.repeat(60),
  goalSupport: 'g'.repeat(60),
  commitment: 'c'.repeat(60),
  termsAgreed: true,
}

describe('submitScholarshipApplication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHeaders.mockResolvedValue(new Headers({ 'x-forwarded-for': '1.2.3.4' }))
    mockCheckRateLimit.mockResolvedValue({ success: true })
    mockFormatPDFData.mockReturnValue({ formatted: true })
    mockGeneratePDF.mockResolvedValue(Buffer.from('pdf'))
    mockRender.mockResolvedValue('<html></html>')
    mockSendEmail.mockResolvedValue({ success: true })
    mockSendConfirmationEmail.mockResolvedValue(undefined)
  })

  it('submits successfully: PDF generated, admin email with attachment, confirmation sent', async () => {
    const result = await submitScholarshipApplication(VALID_INPUT)

    expect(result).toEqual({
      data: { message: 'Your application has been submitted successfully' },
    })
    expect(mockGeneratePDF).toHaveBeenCalledWith({ formatted: true })
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: 'Scholarship Application - Test Student',
        replyTo: 'student@example.com',
        attachments: [
          expect.objectContaining({
            filename: expect.stringContaining('scholarship-application-'),
          }),
        ],
      })
    )
    expect(mockSendConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'student@example.com' })
    )
  })

  it('returns serverError when PDF generation fails', async () => {
    mockGeneratePDF.mockRejectedValue(new Error('boom'))

    const result = await submitScholarshipApplication(VALID_INPUT)

    expect(result).toEqual({
      serverError: 'Failed to generate application PDF. Please try again.',
    })
    expect(mockSendEmail).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalled()
  })

  it('returns serverError when the admin email fails', async () => {
    mockSendEmail.mockResolvedValue({ success: false })

    const result = await submitScholarshipApplication(VALID_INPUT)

    expect(result).toEqual({
      serverError:
        'Failed to send application email. Please try again or contact support.',
    })
    expect(mockSendConfirmationEmail).not.toHaveBeenCalled()
  })

  it('still succeeds when the confirmation email fails', async () => {
    mockSendConfirmationEmail.mockRejectedValue(new Error('smtp down'))

    const result = await submitScholarshipApplication(VALID_INPUT)

    expect(result).toEqual({
      data: { message: 'Your application has been submitted successfully' },
    })
    expect(mockLogWarning).toHaveBeenCalled()
  })

  it('returns validationErrors for invalid input', async () => {
    const result = await submitScholarshipApplication({
      ...VALID_INPUT,
      termsAgreed: false,
    })

    expect(result).toHaveProperty('validationErrors')
    expect(mockGeneratePDF).not.toHaveBeenCalled()
  })

  it('returns the rate-limit message when throttled', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false })

    const result = await submitScholarshipApplication(VALID_INPUT)

    expect(result).toEqual({
      serverError: 'Too many attempts. Please try again later.',
    })
    expect(mockGeneratePDF).not.toHaveBeenCalled()
  })

  it('keeps the 5-attempt budget on the rate limiter', async () => {
    await submitScholarshipApplication(VALID_INPUT)

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'submitScholarshipApplication:1.2.3.4',
      5,
      { failClosed: true }
    )
  })
})
