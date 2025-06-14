import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Attendance Management',
  description: 'Manage class schedules and student attendance',
}

interface AttendanceLayoutProps {
  children: React.ReactNode
}

export default function AttendanceLayout({ children }: AttendanceLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">{children}</main>
    </div>
  )
}
