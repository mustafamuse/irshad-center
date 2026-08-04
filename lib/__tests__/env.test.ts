import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const BASE_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost:5432/test',
  ADMIN_PIN: '1234',
  ADMIN_PASSWORD: 'password',
  MAHAD_INVITE_SECRET: 'test-invite-secret',
  RESEND_API_KEY: 're_test',
  ADMIN_EMAIL: 'admin@example.com',
} as const

async function loadEnv(overrides: Record<string, string> = {}) {
  vi.resetModules()
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    vi.stubEnv(key, value)
  }
  return import('../env')
}

describe('env schema — Upstash rate limiting vars', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.stubEnv('VERCEL_ENV', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('parses when both Upstash vars are absent outside Vercel production', async () => {
    const { env } = await loadEnv()
    expect(env.UPSTASH_REDIS_REST_URL).toBeUndefined()
    expect(env.UPSTASH_REDIS_REST_TOKEN).toBeUndefined()
  })

  it('parses when both Upstash vars are set', async () => {
    const { env } = await loadEnv({
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    })
    expect(env.UPSTASH_REDIS_REST_URL).toBe('https://example.upstash.io')
    expect(env.UPSTASH_REDIS_REST_TOKEN).toBe('token')
  })

  it('rejects a URL without a token', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(
      loadEnv({ UPSTASH_REDIS_REST_URL: 'https://example.upstash.io' })
    ).rejects.toThrow('Missing or invalid environment variables')
  })

  it('rejects a token without a URL', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(
      loadEnv({ UPSTASH_REDIS_REST_TOKEN: 'token' })
    ).rejects.toThrow('Missing or invalid environment variables')
  })

  it('requires both vars on Vercel production', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(loadEnv({ VERCEL_ENV: 'production' })).rejects.toThrow(
      'Missing or invalid environment variables'
    )
  })

  it('does not require them in Vercel preview', async () => {
    const { env } = await loadEnv({ VERCEL_ENV: 'preview' })
    expect(env.UPSTASH_REDIS_REST_URL).toBeUndefined()
  })
})

describe('env schema — Mahad invite secret', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('VERCEL_ENV', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('requires the secret on Vercel production', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(
      loadEnv({
        VERCEL_ENV: 'production',
        UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'token',
        MAHAD_INVITE_SECRET: '',
      })
    ).rejects.toThrow('Missing or invalid environment variables')
  })

  it('does not require it in Vercel preview', async () => {
    const { env } = await loadEnv({
      VERCEL_ENV: 'preview',
      MAHAD_INVITE_SECRET: '',
    })
    expect(env.MAHAD_INVITE_SECRET).toBeUndefined()
  })
})
