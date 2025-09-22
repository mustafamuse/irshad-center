import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Weekend Attendance | Admin Dashboard',
  description: 'Manage weekend study session attendance',
}

export default function AttendanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
