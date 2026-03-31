import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('../admin-auth', () => ({
  verifyAuthToken: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  createActionLogger: () => ({ warn: vi.fn() }),
}))

import { cookies } from 'next/headers'
import { ActionError } from '@/lib/errors/action-error'
import { verifyAuthToken } from '../admin-auth'
import { assertAdmin } from '../assert-admin'

const mockCookies = cookies as unknown as ReturnType<typeof vi.fn>
const mockVerify = verifyAuthToken as unknown as ReturnType<typeof vi.fn>

describe('assertAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws UNAUTHORIZED when no cookie exists', async () => {
    mockCookies.mockResolvedValue({ get: () => undefined })

    const err = await assertAdmin().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ActionError)
    expect(err).toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 })
  })

  it('throws UNAUTHORIZED when token is invalid', async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ value: 'bad-token' }),
    })
    mockVerify.mockReturnValue(false)

    const err = await assertAdmin().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ActionError)
    expect(err).toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 })
    expect(mockVerify).toHaveBeenCalledWith('bad-token')
  })

  it('resolves when token is valid', async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ value: 'valid-token' }),
    })
    mockVerify.mockReturnValue(true)

    await expect(assertAdmin()).resolves.toBeUndefined()
    expect(mockVerify).toHaveBeenCalledWith('valid-token')
  })
})
