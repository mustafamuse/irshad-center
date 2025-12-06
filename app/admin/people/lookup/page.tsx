import { Suspense } from 'react'

import { PersonLookupClient } from './components/person-lookup-client'

export default function PersonLookupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Person Lookup</h1>
        <p className="text-muted-foreground">
          Search by email, phone, or name to see all information and
          relationships
        </p>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <PersonLookupClient />
      </Suspense>
    </div>
  )
}
