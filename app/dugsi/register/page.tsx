import { Metadata } from 'next'

import { getAcademicYear } from '@/lib/utils/academic-year'

import { DugsiRegisterPage } from './register-page'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const description = `Register your child for the ${getAcademicYear()} academic year at Irshād Dugsi. Weekend Islamic education program for children in Eden Prairie.`
  return {
    title: 'Child Registration - Irshād Dugsi',
    description,
    openGraph: {
      title: 'Child Registration - Irshād Dugsi',
      description,
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
      description,
      images: ['/images/Dugsi.svg'],
    },
  }
}

export default function Page() {
  return <DugsiRegisterPage />
}
