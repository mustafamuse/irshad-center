'use client'

import { usePathname } from 'next/navigation'

import { GlobalHeader } from './global-header'

export function ConditionalAdminHeader() {
  const pathname = usePathname()
  const isDugsiAdmin = pathname === '/admin/dugsi'
  const isV2Dashboard = pathname === '/admin/v2'

  if (isDugsiAdmin || isV2Dashboard) return null

  return <GlobalHeader variant="admin" />
}
