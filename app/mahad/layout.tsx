import { Metadata } from 'next'

import { AppErrorBoundary } from '@/components/error-boundary'

export const metadata: Metadata = {
  title: 'Irshād Mâhad - Islamic Studies & Arabic Institute',
  description:
    "Accredited two-year Islamic education program in English at Eden Prairie. Study Qur'an, Fiqh, Hadith, and Arabic from distinguished Sheikhs and Islamic university graduates",
}

export default function MahadLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppErrorBoundary context="Mahad section" variant="fullscreen">
      {children}
    </AppErrorBoundary>
  )
}
