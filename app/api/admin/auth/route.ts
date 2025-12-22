import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { createActionLogger, logError } from '@/lib/logger'
import { checkAdminLoginRateLimit } from '@/lib/ratelimit'
import {
  createSessionToken,
  getSessionCookieOptions,
  verifyEnvPassword,
} from '@/lib/utils/admin-auth'
import { AdminLoginSchema } from '@/lib/validations/admin-auth'

const logger = createActionLogger('admin-auth')

export async function POST(request: Request) {
  try {
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'

    const rateLimit = await checkAdminLoginRateLimit(ip)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.reset ?? 0) / 1000)),
          },
        }
      )
    }

    const body = await request.json()
    const parseResult = AdminLoginSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      )
    }

    const { password } = parseResult.data

    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword) {
      logger.error('ADMIN_PASSWORD environment variable not set')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (!verifyEnvPassword(password, adminPassword)) {
      logger.warn({ ip }, 'Failed login attempt')
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
    }

    const token = createSessionToken()
    const cookieOptions = getSessionCookieOptions()

    const cookieStore = await cookies()
    cookieStore.set(cookieOptions.name, token, {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path,
      maxAge: cookieOptions.maxAge,
    })

    logger.info('Admin login successful')
    return NextResponse.json({ success: true })
  } catch (error) {
    await logError(logger, error, 'Authentication failed')
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete('admin_session')

    logger.info('Admin logout successful')
    return NextResponse.json({ success: true })
  } catch (error) {
    await logError(logger, error, 'Logout failed')
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
