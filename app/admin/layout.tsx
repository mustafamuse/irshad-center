import { AdminHeader } from '@/components/layout/admin-header'
import { Separator } from '@/components/ui/separator'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

import { AdminSidebar } from './_components/admin-sidebar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />
        <Separator />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <main className="flex-1">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
