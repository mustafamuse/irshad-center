'use client'

import { Logo } from '@/components/ui/logo'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

export function ConditionalAdminHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex items-center gap-2">
        <Logo size="xs" className="h-8 w-auto" />
      </div>
    </header>
  )
}
