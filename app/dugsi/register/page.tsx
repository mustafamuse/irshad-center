import { Metadata } from 'next'

import { DugsiRegisterPage } from './register-page'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Child Registration - Irshād Dugsi',
  description:
    'Register your child for the 2024-2025 academic year at Irshād Dugsi. Weekend Islamic education program for children in Eden Prairie.',
  openGraph: {
    title: 'Child Registration - Irshād Dugsi',
    description:
      'Register your child for the 2024-2025 academic year at Irshād Dugsi. Weekend Islamic education program for children in Eden Prairie.',
    images: [
      {
        url: '/images/Latest Irshad Mahad.png',
        width: 1200,
        height: 630,
        alt: 'Irshād Dugsi Registration',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Child Registration - Irshād Dugsi',
    description:
      'Register your child for the 2024-2025 academic year at Irshād Dugsi. Weekend Islamic education program for children in Eden Prairie.',
    images: ['/images/Latest Irshad Mahad.png'],
  },
}

export default function Page() {
  return <DugsiRegisterPage />
}
