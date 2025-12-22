import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false
  return token.length === 64
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Admin login page - redirect to admin if already authenticated
  if (path === '/admin/login') {
    const session = request.cookies.get('admin_session')
    if (session && isValidSessionToken(session.value)) {
      return NextResponse.redirect(new URL('/admin/dugsi', request.url))
    }
    return NextResponse.next()
  }

  // Protected admin routes - require valid session
  if (path.startsWith('/admin')) {
    const session = request.cookies.get('admin_session')

    if (!session || !isValidSessionToken(session.value)) {
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
