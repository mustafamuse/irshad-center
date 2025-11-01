import { getDugsiRegistrations } from './actions'
import { DugsiDashboard } from './components/dugsi-dashboard'
import { DugsiErrorBoundary } from './components/error-boundary'

export const dynamic = 'force-dynamic'

export default async function DugsiAdminPage() {
  const registrations = await getDugsiRegistrations()

  return (
    <DugsiErrorBoundary>
      <DugsiDashboard registrations={registrations} />
    </DugsiErrorBoundary>
  )
}
