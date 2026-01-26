import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { Logger } from 'next-axiom'

import { verifyAuthTokenEdge } from '@/lib/auth/admin-auth.edge'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const startTime = Date.now()

  const axiomLogger =
    process.env.NODE_ENV === 'production'
      ? new Logger({ source: 'middleware' })
      : null

  axiomLogger?.info('Request', {
    path,
    method: request.method,
    userAgent: request.headers.get('user-agent'),
  })

  let response: NextResponse

  if (path.startsWith('/admin') && !path.startsWith('/admin/login')) {
    const authCookie = request.cookies.get('admin_auth')

    if (!authCookie || !(await verifyAuthTokenEdge(authCookie.value))) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', path)
      response = NextResponse.redirect(loginUrl)
    } else {
      response = NextResponse.next()
    }
  } else {
    response = NextResponse.next()
  }

  const duration = Date.now() - startTime
  response.headers.set('x-response-time', `${duration}ms`)

  axiomLogger?.info('Response', {
    path,
    method: request.method,
    duration,
  })

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
}
