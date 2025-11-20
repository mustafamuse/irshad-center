import { Metadata } from 'next'

import { ProgramsContent } from './_components/content'

export const metadata: Metadata = {
  title: 'Academic Programs | Mahad',
  description:
    'Comprehensive 2-year Islamic education curriculum covering Quranic studies, Islamic jurisprudence, Hadith, and more',
}

export default function ProgramsPage() {
  return <ProgramsContent />
}
