'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function validateAdminPin(
  pin: string,
  redirectTo: string
): Promise<{ success: boolean; error?: string }> {
  const expectedPin = process.env.ADMIN_PIN

  if (!expectedPin) {
    return { success: false, error: 'Server configuration error' }
  }

  if (pin !== expectedPin) {
    return { success: false, error: 'Invalid PIN' }
  }

  const cookieStore = await cookies()
  cookieStore.set('admin_auth', 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  })

  const safeRedirect = redirectTo?.startsWith('/admin') ? redirectTo : '/admin'
  redirect(safeRedirect)
}

export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('admin_auth')
  redirect('/admin/login')
}
