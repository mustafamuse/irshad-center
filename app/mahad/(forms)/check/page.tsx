import { Metadata } from 'next'

import { StudentLookupForm } from './_components/student-lookup-form'
import { MahadPageHeader } from '../../_components/mahad-page-header'

const description =
  'Confirm whether you are already registered for Irshād Māhad using your first name, last name, and last 4 digits of your phone.'

export const metadata: Metadata = {
  title: 'Check Registration - Irshād Māhad',
  description,
  openGraph: {
    title: 'Check Registration - Irshād Māhad',
    description,
    images: [
      {
        url: '/images/Mahad.svg',
        width: 1200,
        height: 630,
        alt: 'Irshād Māhad',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Check Registration - Irshād Māhad',
    description,
    images: ['/images/Mahad.svg'],
  },
}

export default function MahadCheckRegistrationPage() {
  return (
    <>
      <MahadPageHeader
        title="Mahad registration lookup"
        description="See if you are already registered. If not, you can complete registration in a few minutes."
      />
      <main>
        <StudentLookupForm />
      </main>
    </>
  )
}
