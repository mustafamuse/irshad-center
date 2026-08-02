import Link from 'next/link'

import { Button } from '@/components/ui/button'
import type { LookupResult } from '@/lib/services/mahad/verification-service'

import { MahadStatusView } from '../../../../check/_components/shared/mahad-status-view'

type FoundResult = Extract<LookupResult, { found: true }>

export function SuccessSummary({ result }: { result: FoundResult }) {
  return (
    <div className="space-y-6">
      <MahadStatusView result={result} context="just_registered" />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="outline" className="flex-1">
          <Link href="/mahad/check">Check status anytime</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href="/mahad/register">Register another student</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href="/mahad">Back to home</Link>
        </Button>
      </div>
    </div>
  )
}
