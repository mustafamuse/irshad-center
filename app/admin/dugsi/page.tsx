import { getDugsiRegistrations } from './actions'
import { DugsiDashboard } from './components/dugsi-dashboard'

export const dynamic = 'force-dynamic'

export default async function DugsiAdminPage() {
  const registrations = await getDugsiRegistrations()

  return <DugsiDashboard registrations={registrations} />
}
