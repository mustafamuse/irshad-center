import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'

import { Logger } from 'next-axiom'

import { verifyAuthTokenEdge } from '@/lib/auth/admin-auth.edge'
import { verifyTeacherAuthTokenEdge } from '@/lib/auth/teacher-auth.edge'

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const path = request.nextUrl.pathname
  const startTime = Date.now()

  const axiomLogger =
    process.env.NODE_ENV === 'production'
      ? new Logger({ source: 'middleware' })
      : null

  const authRoutes = [
    {
      prefix: '/admin',
      cookie: 'admin_auth',
      verify: verifyAuthTokenEdge,
    },
    {
      prefix: '/teacher',
      cookie: 'teacher_auth',
      verify: verifyTeacherAuthTokenEdge,
    },
  ] as const

  let response: NextResponse = NextResponse.next()

  for (const route of authRoutes) {
    if (
      !path.startsWith(route.prefix) ||
      path.startsWith(`${route.prefix}/login`)
    )
      continue

    const authCookie = request.cookies.get(route.cookie)
    if (!authCookie || !(await route.verify(authCookie.value))) {
      const loginUrl = new URL(`${route.prefix}/login`, request.url)
      const safeRedirect = /^\/[a-zA-Z]/.test(path) ? path : `${route.prefix}`
      loginUrl.searchParams.set('redirect', safeRedirect)
      response = NextResponse.redirect(loginUrl)
    }
    break
  }

  axiomLogger?.info('Request handled', {
    path,
    method: request.method,
    duration: Date.now() - startTime,
  })

  if (axiomLogger) {
    event.waitUntil(axiomLogger.flush())
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*'],
}
