import { AdminLayoutClient } from './components/admin-layout-client'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
