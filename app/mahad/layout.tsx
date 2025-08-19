import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Irshād Mâhad - Islamic Education',
  description:
    'Comprehensive Islamic education and payment management system at Irshād Mâhad, Eden Prairie.',
}

export default function MahadLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
