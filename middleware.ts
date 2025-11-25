import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Generate or reuse request ID for correlation across services
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()

  // Create response with request ID injected
  const response = NextResponse.next()
  response.headers.set('x-request-id', requestId)

  // Protected routes that require authentication/authorization
  const protectedRoutes = ['/admin-access', '/dashboard', '/admin/dashboard']

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some((route) =>
    path.startsWith(route)
  )

  // If it's not a protected route, allow access with request ID
  if (!isProtectedRoute) {
    return response
  }

  return response
}

export const config = {
  // Apply middleware to all routes to inject request ID
  // Exclude static files, Next.js internals, and specific paths
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
