import { Metadata } from 'next'

import { MahadErrorBoundary } from './_components/error-boundary'

export const metadata: Metadata = {
  title: 'Irshād Mâhad - Islamic Studies & Arabic Institute',
  description:
    "Accredited two-year Islamic education program in English at Eden Prairie. Study Qur'an, Fiqh, Hadith, and Arabic from distinguished Sheikhs and Islamic university graduates",
}

/**
 * Root layout for mahad section
 * Includes error boundary to catch uncaught errors and prevent app crashes
 */
export default function MahadLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MahadErrorBoundary>{children}</MahadErrorBoundary>
}
