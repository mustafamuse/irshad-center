import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Protected routes that require authentication/authorization
  const protectedRoutes = [
    '/batches',
    '/admin-access',
    '/dashboard',
    '/admin/dashboard',
  ]

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some((route) =>
    path.startsWith(route)
  )

  // If it's not a protected route, allow access
  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  // Only apply middleware to specific protected routes
  // This ensures webhook and other API routes are completely excluded
  matcher: [
    '/batches/:path*',
    '/admin-access/:path*',
    '/dashboard/:path*',
    '/admin/dashboard/:path*',
  ],
}
