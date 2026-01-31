'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'

interface Props {
  page: number
  totalPages: number
  total: number
}

export function PaginationControls({ page, totalPages, total }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function goToPage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(newPage))
    router.push(`/admin/dugsi/attendance?${params.toString()}`)
  }

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Page {page} of {totalPages} ({total} sessions)
      </span>
      <div className="flex gap-2">
        <Button
          disabled={page <= 1}
          size="sm"
          variant="outline"
          onClick={() => goToPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          disabled={page >= totalPages}
          size="sm"
          variant="outline"
          onClick={() => goToPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
