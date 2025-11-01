import { getDugsiRegistrations } from './actions'
import { DugsiRegistrationsTable } from './components/dugsi-registrations-table'
import { DugsiStats } from './components/dugsi-stats'

export const dynamic = 'force-dynamic'

export default async function DugsiAdminPage() {
  const registrations = await getDugsiRegistrations()

  return (
    <div className="container mx-auto space-y-6 p-4 sm:space-y-8 sm:p-6">
      <div className="flex flex-col gap-2 sm:gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Dugsi Registrations
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Manage student registrations and family subscriptions for the Dugsi
          program.
        </p>
      </div>

      <DugsiStats registrations={registrations} />

      <DugsiRegistrationsTable registrations={registrations} />
    </div>
  )
}
