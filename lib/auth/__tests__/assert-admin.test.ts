import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockLoggerWarn, mockLoggerChild } = vi.hoisted(() => {
  const mockLoggerWarn = vi.fn()
  const mockLoggerChild = vi.fn(() => ({ warn: mockLoggerWarn }))
  return { mockLoggerWarn, mockLoggerChild }
})

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('../admin-auth', () => ({
  verifyAuthToken: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  createActionLogger: () => ({
    warn: mockLoggerWarn,
    child: mockLoggerChild,
  }),
}))

import { cookies } from 'next/headers'
import { ActionError } from '@/lib/errors/action-error'
import { verifyAuthToken } from '../admin-auth'
import { assertAdmin } from '../assert-admin'

const mockCookies = vi.mocked(cookies)
const mockVerify = vi.mocked(verifyAuthToken)

function mockCookieStore(value?: string) {
  const get = () =>
    value !== undefined ? { name: 'admin_auth', value } : undefined
  mockCookies.mockResolvedValue({ get } as Awaited<ReturnType<typeof cookies>>)
}

describe('assertAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws UNAUTHORIZED when no cookie exists', async () => {
    mockCookieStore()

    const err = await assertAdmin().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ActionError)
    expect(err).toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 })
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Admin auth check failed: no token cookie'
    )
  })

  it('throws UNAUTHORIZED when token is invalid', async () => {
    mockCookieStore('bad-token')
    mockVerify.mockReturnValue(false)

    const err = await assertAdmin().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ActionError)
    expect(err).toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 })
    expect(mockVerify).toHaveBeenCalledWith('bad-token')
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Admin auth check failed: token verification failed'
    )
  })

  it('resolves when token is valid', async () => {
    mockCookieStore('valid-token')
    mockVerify.mockReturnValue(true)

    await expect(assertAdmin()).resolves.toBeUndefined()
    expect(mockVerify).toHaveBeenCalledWith('valid-token')
    expect(mockLoggerWarn).not.toHaveBeenCalled()
  })

  it('creates child logger with caller context when provided', async () => {
    mockCookieStore()

    await assertAdmin('myAction').catch(() => {})
    expect(mockLoggerChild).toHaveBeenCalledWith({ caller: 'myAction' })
    expect(mockLoggerWarn).toHaveBeenCalledOnce()
  })

  it('uses base logger when no caller provided', async () => {
    mockCookieStore()

    await assertAdmin().catch(() => {})
    expect(mockLoggerChild).not.toHaveBeenCalled()
    expect(mockLoggerWarn).toHaveBeenCalledOnce()
  })
})
