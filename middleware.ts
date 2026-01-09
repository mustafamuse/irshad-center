
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import crypto from 'crypto'

function verifyAuthToken(token: string): boolean {
  const [timestamp, signature] = token.split('.')
  if (!timestamp || !signature) return false

  const secret = process.env.ADMIN_PIN || ''
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(timestamp)
    .digest('hex')

  if (signature.length !== expectedSignature.length) return false

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (path.startsWith('/admin') && !path.startsWith('/admin/login')) {
    const authCookie = request.cookies.get('admin_auth')

    if (!authCookie || !verifyAuthToken(authCookie.value)) {
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
