import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { createActionLogger, logError } from '@/lib/logger'
import {
  createSessionToken,
  getSessionCookieOptions,
  verifyEnvPassword,
} from '@/lib/utils/admin-auth'

const logger = createActionLogger('admin-auth')

export async function POST(request: Request) {
  try {
    const { password } = await request.json()

    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword) {
      logger.error('ADMIN_PASSWORD environment variable not set')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (!password || !verifyEnvPassword(password, adminPassword)) {
      logger.warn('Failed login attempt')
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
