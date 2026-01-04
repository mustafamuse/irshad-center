import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * SECURITY MODEL:
 * ----------------
 * Edge middleware cannot perform HMAC signature verification because Node.js
 * crypto APIs are not available in the Edge runtime. This is an intentional
 * limitation of the Edge runtime for performance reasons.
 *
 * The security boundary is therefore the SERVER, not the middleware:
 * 1. Middleware: Fast format/expiration checks to redirect obviously invalid requests
 * 2. Server Actions: Full cryptographic validation via requireAdminSession() or withAdminAuth()
 *
 * An attacker could forge a token with valid format, but:
 * - They cannot forge a valid HMAC signature without ADMIN_SESSION_SECRET
 * - All data-mutating operations go through Server Actions which validate cryptographically
 * - The middleware is a UX optimization, not a security boundary
 *
 * IMPORTANT: All admin Server Actions MUST use requireAdminSession() or withAdminAuth()
 * from lib/utils/admin-auth.ts to enforce authentication.
 */

/**
 * Basic token format validation for Edge middleware.
 * This is NOT a security check - it's a UX optimization to redirect invalid sessions.
 * Token format: timestamp.randomData.signature
 */
function hasValidTokenFormat(token: string | undefined): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [expiresAtStr, randomData, signature] = parts
  const expiresAt = parseInt(expiresAtStr, 10)

  // Basic format checks
  if (isNaN(expiresAt)) return false
  if (!randomData || randomData.length !== 64) return false
  if (!signature || signature.length !== 64) return false

  // Check if not expired (basic check, full validation in server)
  if (Date.now() > expiresAt) return false

  return true
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Admin login page - redirect to admin if already authenticated
  if (path === '/admin/login') {
    const session = request.cookies.get('admin_session')
    if (session && hasValidTokenFormat(session.value)) {
      return NextResponse.redirect(new URL('/admin/dugsi', request.url))
    }
    return NextResponse.next()
  }

  // Protected admin routes - require valid session
  if (path.startsWith('/admin')) {
    const session = request.cookies.get('admin_session')

    if (!session || !hasValidTokenFormat(session.value)) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Legacy protected routes
  const protectedRoutes = ['/admin-access', '/dashboard', '/admin/dashboard']
  const isProtectedRoute = protectedRoutes.some((route) =>
    path.startsWith(route)
  )

  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/admin-access/:path*',
    '/dashboard/:path*',
  ],
}
