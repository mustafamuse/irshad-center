import Link from 'next/link'

import { ArrowLeft } from 'lucide-react'
import { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'

import { MahadPublicProviders } from '../_components/mahad-public-providers'

import { StudentLookupForm } from './_components/student-lookup-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Check Registration - Irshād Māhad',
  description:
    'Confirm whether you are already registered for Irshād Māhad using your last name and phone.',
}

export default function MahadStudentsLookupPage() {
  return (
    <MahadPublicProviders context="Mahad students lookup">
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-8 md:px-6 md:py-12">
          <div className="mb-8 flex items-center justify-between">
            <Button
              asChild
              variant="ghost"
              className="h-10 gap-2 rounded-xl text-sm text-[#007078] hover:bg-[#007078]/10"
            >
              <Link href="/mahad">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </Link>
            </Button>
            <div className="w-32">
              <Logo size="sm" className="w-full" />
            </div>
          </div>

          <div className="mx-auto max-w-2xl">
            <header className="mb-12 space-y-3 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-[#007078] sm:text-4xl">
                Mahad registration lookup
              </h1>
              <p className="text-lg text-gray-600">
                See if you are already registered. If not, you can complete
                registration in a few minutes.
              </p>
            </header>
            <StudentLookupForm />
          </div>
        </div>
      </div>
    </MahadPublicProviders>
  )
}
