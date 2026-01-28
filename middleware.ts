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
  } else if (
    path.startsWith('/teacher') &&
    !path.startsWith('/teacher/login')
  ) {
    const authCookie = request.cookies.get('teacher_auth')

    if (!authCookie || !(await verifyTeacherAuthTokenEdge(authCookie.value))) {
      const loginUrl = new URL('/teacher/login', request.url)
      loginUrl.searchParams.set('redirect', path)
      response = NextResponse.redirect(loginUrl)
    } else {
      response = NextResponse.next()
    }
  } else {
    response = NextResponse.next()
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
