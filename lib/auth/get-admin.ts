import { cache } from 'react'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { verifyAuthToken } from './admin-auth'

export const requireAdmin = cache(async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_auth')?.value

  if (!token) {
    redirect('/admin/login')
  }

  if (!verifyAuthToken(token)) {
    redirect('/admin/login')
  }
})
