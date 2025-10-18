'use client'

import { usePathname } from 'next/navigation'

import { GlobalHeader } from './global-header'

export function ConditionalAdminHeader() {
  const pathname = usePathname()
  const isDugsiAdmin = pathname === '/admin/dugsi'

  if (isDugsiAdmin) return null

  return <GlobalHeader variant="admin" />
}
