import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockLimit } = vi.hoisted(() => ({
  mockLimit: vi.fn(),
}))

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(
    vi.fn().mockImplementation(() => ({
      limit: (id: string) => mockLimit(id),
    })),
    {
      slidingWindow: vi.fn().mockReturnValue('slidingWindow'),
    }
  ),
}))

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({}),
  },
}))

const originalEnv = { ...process.env }

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns the limiter result when Redis is configured', async () => {
    mockLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      reset: 1_700_000_000,
    })
    const { checkRateLimit } = await import('../rate-limit')

    const result = await checkRateLimit('ip-1')

    expect(result).toEqual({
      success: false,
      remaining: 0,
      reset: 1_700_000_000,
    })
    expect(mockLimit).toHaveBeenCalledWith('ip-1')
  })

  it('fails open and logs when Redis env vars are missing', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { checkRateLimit } = await import('../rate-limit')
    const result = await checkRateLimit('ip-1')

    expect(result.success).toBe(true)
    expect(mockLimit).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  it('fails open and logs when the Redis call throws', async () => {
    mockLimit.mockRejectedValueOnce(new Error('network blip'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { checkRateLimit } = await import('../rate-limit')
    const result = await checkRateLimit('ip-1', 10)

    expect(result).toEqual({ success: true, remaining: 10, reset: 0 })
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})
