import Link from 'next/link'

import { Metadata } from 'next'

import { MahadPublicProviders } from '../_components/mahad-public-providers'
import { MahadPublicShell } from '../_components/mahad-public-shell'
import { RegisterForm } from './_components/registration-form'

export const metadata: Metadata = {
  title: 'Student Registration - Irshād Māhad',
  description: 'Register for the 2024-2025 academic year at Irshād Māhad.',
}

export default function RegisterPage() {
  return (
    <MahadPublicProviders context="Mahad registration">
      <MahadPublicShell
        title="Student Registration"
        description="Join our 2024-2025 academic year at Irshād Māhad"
        headerExtra={
          <p className="text-sm text-gray-600">
            Already registered?{' '}
            <Link
              href="/mahad/students"
              className="font-medium text-[#007078] underline-offset-4 hover:underline"
            >
              Check your registration status
            </Link>{' '}
            before submitting again.
          </p>
        }
      >
        <RegisterForm />
      </MahadPublicShell>
    </MahadPublicProviders>
  )
}
