import { Metadata } from 'next'

import { getDugsiRegistrations } from './actions'
import { DugsiDashboard } from './components/dugsi-dashboard'
import { DugsiErrorBoundary } from './components/error-boundary'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Dugsi Admin',
  description: 'Manage Dugsi program registrations and families',
}

export default async function DugsiAdminPage() {
  const registrations = await getDugsiRegistrations()

  return (
    <DugsiErrorBoundary>
      <DugsiDashboard registrations={registrations} />
    </DugsiErrorBoundary>
  )
}
