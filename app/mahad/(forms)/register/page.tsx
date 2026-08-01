import Link from 'next/link'

import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

import { getAcademicYear } from '@/lib/utils/academic-year'

import { RegisterForm } from './_components/registration-form'
import { MahadPageHeader } from '../../_components/mahad-page-header'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Student Registration - Irshād Māhad',
    description: `Register for the ${getAcademicYear()} academic year at Irshād Māhad.`,
    openGraph: {
      title: 'Student Registration - Irshād Māhad',
      description: `Register for the ${getAcademicYear()} academic year at Irshād Māhad.`,
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
      title: 'Student Registration - Irshād Māhad',
      description: `Register for the ${getAcademicYear()} academic year at Irshād Māhad.`,
      images: ['/images/Mahad.svg'],
    },
  }
}

export default function RegisterPage() {
  return (
    <>
      <MahadPageHeader
        title="Student Registration"
        description={`Join our ${getAcademicYear()} academic year at Irshād Māhad`}
        headerExtra={
          <div className="mx-auto max-w-md space-y-2 text-sm text-gray-600">
            <p>
              Takes about 2 minutes. After submitting you&apos;ll get a
              confirmation page — save its URL. Ustadh Mustafa will message you
              a payment link via WhatsApp within 1 business day.
            </p>
            <p>
              Already registered?{' '}
              <Link
                href="/mahad/check"
                className="font-medium text-brand underline-offset-4 hover:underline"
              >
                Check your registration status
              </Link>{' '}
              before submitting again.
            </p>
          </div>
        }
      />
      <main>
        <RegisterForm />
      </main>
    </>
  )
}
