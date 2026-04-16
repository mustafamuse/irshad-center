import { Metadata } from 'next'

import { MahadPublicProviders } from '../_components/mahad-public-providers'
import { MahadPublicShell } from '../_components/mahad-public-shell'
import { StudentLookupForm } from './_components/student-lookup-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Check Registration - Irshād Māhad',
  description:
    'Confirm whether you are already registered for Irshād Māhad using your last name and phone.',
}

export default function MahadStudentsLookupPage() {
  return (
    <MahadPublicProviders context="Mahad lookup">
      <MahadPublicShell
        title="Mahad registration lookup"
        description="See if you are already registered. If not, you can complete registration in a few minutes."
      >
        <StudentLookupForm />
      </MahadPublicShell>
    </MahadPublicProviders>
  )
}
