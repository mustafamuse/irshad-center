import { Metadata } from 'next'

import { getAcademicYear } from '@/lib/utils/academic-year'

import { DugsiRegisterPage } from './register-page'

export const dynamic = 'force-dynamic'

const dugsiDescription = `Register your child for the ${getAcademicYear()} academic year at Irshād Dugsi. Weekend Islamic education program for children in Eden Prairie.`

export const metadata: Metadata = {
  title: 'Child Registration - Irshād Dugsi',
  description: dugsiDescription,
  openGraph: {
    title: 'Child Registration - Irshād Dugsi',
    description: dugsiDescription,
    images: [
      {
        url: '/images/Dugsi.svg',
        width: 1200,
        height: 630,
        alt: 'Irshād Dugsi',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Child Registration - Irshād Dugsi',
    description: dugsiDescription,
    images: ['/images/Dugsi.svg'],
  },
}

export default function Page() {
  return <DugsiRegisterPage />
}
