'use client'

import { AdminHeader } from '@/components/layout/admin-header'
import { Separator } from '@/components/ui/separator'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

import { AdminSidebar } from './_components/admin-sidebar'
import { CommandPalette } from './components/command-palette'
import {
  CommandPaletteProvider,
  useCommandPalette,
} from './components/command-palette-provider'

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = useCommandPalette()

  return (
    <>
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />
        <Separator />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <main className="flex-1">{children}</main>
        </div>
      </SidebarInset>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  )
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      <SidebarProvider>
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </SidebarProvider>
    </CommandPaletteProvider>
  )
}
