import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Route redirects for new admin structure
  const redirects: Record<string, string> = {
    '/admin/payments': '/admin/billing/invoices',
    '/admin/link-subscriptions': '/admin/billing/subscriptions/link',
    '/admin/profit-share': '/admin/billing/profit-share',
    // Note: keeping /admin/mahad/cohorts as-is for now
  }

  // Check if current path needs redirect
  if (redirects[path]) {
    const url = request.nextUrl.clone()
    url.pathname = redirects[path]
    return NextResponse.redirect(url, { status: 301 })
  }

  // Protected routes that require authentication/authorization
  const protectedRoutes = ['/admin-access', '/dashboard', '/admin/dashboard']

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
  // Only apply middleware to specific protected routes and redirect routes
  // This ensures webhook and other API routes are completely excluded
  matcher: [
    '/admin-access/:path*',
    '/dashboard/:path*',
    '/admin/dashboard/:path*',
    '/admin/payments',
    '/admin/link-subscriptions',
    '/admin/profit-share',
  ],
}
