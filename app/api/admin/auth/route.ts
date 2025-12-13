import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import {
  createSessionToken,
  getSessionCookieOptions,
  verifyPassword,
} from '@/lib/utils/admin-auth'

export async function POST(request: Request) {
  try {
    const { password } = await request.json()

    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword) {
      console.error('ADMIN_PASSWORD environment variable not set')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (!password || !verifyPassword(password, adminPassword)) {
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

    return NextResponse.json({ success: true })
  } catch {
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

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
