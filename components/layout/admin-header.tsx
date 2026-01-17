'use client'

import { LogOut, Search } from 'lucide-react'

import { useCommandPalette } from '@/app/admin/components/command-palette-provider'
import { logoutAdmin } from '@/app/admin/login/actions'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'


export function AdminHeader() {
  const { setOpen } = useCommandPalette()

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex flex-1 items-center justify-between">
        <Logo size="xs" className="h-8 w-auto" />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(true)}
            className="hidden sm:flex"
          >
            <Search className="mr-2 h-4 w-4" />
            <span className="hidden lg:inline">Search</span>
            <kbd className="pointer-events-none ml-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 lg:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
          <form action={logoutAdmin}>
            <Button variant="ghost" size="sm" type="submit">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
