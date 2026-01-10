import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAuthTokenEdge } from '@/lib/auth/admin-auth'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (path.startsWith('/admin') && !path.startsWith('/admin/login')) {
    const authCookie = request.cookies.get('admin_auth')

    if (!authCookie || !(await verifyAuthTokenEdge(authCookie.value))) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', path)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
