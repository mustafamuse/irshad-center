import { Metadata } from 'next'

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
  return <>{children}</>
}
