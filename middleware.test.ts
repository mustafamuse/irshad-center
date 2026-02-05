import { NextRequest } from 'next/server'

import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockVerifyAdmin = vi.fn()
const mockVerifyTeacher = vi.fn()

vi.mock('@/lib/auth/admin-auth.edge', () => ({
  verifyAuthTokenEdge: (...args: unknown[]) => mockVerifyAdmin(...args),
}))

vi.mock('@/lib/auth/teacher-auth.edge', () => ({
  verifyTeacherAuthTokenEdge: (...args: unknown[]) =>
    mockVerifyTeacher(...args),
}))

vi.mock('next-axiom', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
  })),
}))

import { middleware } from './middleware'

function createRequest(path: string, cookies: Record<string, string> = {}) {
  const url = `http://localhost:3000${path}`
  const req = new NextRequest(new URL(url))
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value)
  }
  return req
}

const mockEvent = { waitUntil: vi.fn() } as never

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('admin auth routing', () => {
    it('redirects to login when no admin cookie', async () => {
      const req = createRequest('/admin/dugsi')
      const res = await middleware(req, mockEvent)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/admin/login')
    })

    it('redirects to login when invalid admin token', async () => {
      mockVerifyAdmin.mockResolvedValue(false)
      const req = createRequest('/admin/dugsi', { admin_auth: 'bad-token' })
      const res = await middleware(req, mockEvent)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/admin/login')
    })

    it('allows access with valid admin token', async () => {
      mockVerifyAdmin.mockResolvedValue(true)
      const req = createRequest('/admin/dugsi', { admin_auth: 'valid-token' })
      const res = await middleware(req, mockEvent)
      expect(res.status).toBe(200)
    })

    it('skips auth for admin login page', async () => {
      const req = createRequest('/admin/login')
      const res = await middleware(req, mockEvent)
      expect(res.status).toBe(200)
      expect(mockVerifyAdmin).not.toHaveBeenCalled()
    })
  })

  describe('teacher auth routing', () => {
    it('redirects to login when no teacher cookie', async () => {
      const req = createRequest('/teacher/attendance')
      const res = await middleware(req, mockEvent)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/teacher/login')
    })

    it('allows access with valid teacher token', async () => {
      mockVerifyTeacher.mockResolvedValue(true)
      const req = createRequest('/teacher/attendance', {
        teacher_auth: 'valid',
      })
      const res = await middleware(req, mockEvent)
      expect(res.status).toBe(200)
    })

    it('skips auth for teacher login page', async () => {
      const req = createRequest('/teacher/login')
      const res = await middleware(req, mockEvent)
      expect(res.status).toBe(200)
      expect(mockVerifyTeacher).not.toHaveBeenCalled()
    })
  })

  describe('safe redirect logic', () => {
    it('includes path in redirect search params', async () => {
      const req = createRequest('/admin/dugsi/students')
      const res = await middleware(req, mockEvent)
      const location = res.headers.get('location')!
      const url = new URL(location)
      expect(url.searchParams.get('redirect')).toBe('/admin/dugsi/students')
    })

    it('validates safe redirect regex pattern', () => {
      const safePattern = /^\/[a-zA-Z]/
      expect(safePattern.test('/admin/dugsi')).toBe(true)
      expect(safePattern.test('//evil.com')).toBe(false)
      expect(safePattern.test('/123')).toBe(false)
      expect(safePattern.test('')).toBe(false)
    })
  })
})
