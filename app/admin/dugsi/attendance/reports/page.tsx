import { Suspense } from 'react'

import { Loader2 } from 'lucide-react'

import { getAllDugsiClasses } from '@/lib/db/queries/dugsi-class'

import { ReportsDashboard } from './_components/reports-dashboard'

export const dynamic = 'force-dynamic'

async function ReportsData() {
  const classes = await getAllDugsiClasses()

  return <ReportsDashboard classes={classes} />
}

export default function ReportsPage() {
  return (
    <div className="container mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <ReportsData />
      </Suspense>
    </div>
  )
}
