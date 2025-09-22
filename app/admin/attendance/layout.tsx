'use client'

import { BatchProvider } from '@/app/batches/_providers/batch-provider'

export default function AttendanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <BatchProvider>{children}</BatchProvider>
}
