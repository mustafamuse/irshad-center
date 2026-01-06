'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PaymentsPaginationProps {
  pageCount: number
}

export function PaymentsPagination({ pageCount }: PaymentsPaginationProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const currentPage = Number(searchParams.get('page')) || 1
  const perPage = Number(searchParams.get('per_page')) || 10

  const createPageURL = (pageNumber: number | string) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', pageNumber.toString())
    return `${pathname}?${params.toString()}`
  }

  const createPerPageURL = (perPageValue: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('per_page', perPageValue)
    params.set('page', '1') // Reset to first page when changing per page
    return `${pathname}?${params.toString()}`
  }

  const canGoToPreviousPage = currentPage > 1
  const canGoToNextPage = currentPage < pageCount

  return (
    <div className="space-y-4 bg-background px-4 py-4 sm:p-0">
      {/* Mobile Layout */}
      <div className="flex flex-col space-y-4 sm:hidden">
        {/* Page indicator */}
        <div className="flex items-center justify-center text-sm text-muted-foreground">
          Page {currentPage} of {pageCount}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            className="h-10 border-border bg-background px-4 text-foreground hover:bg-accent"
            disabled={!canGoToPreviousPage}
            onClick={() => router.push(createPageURL(currentPage - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 border-border bg-background px-4 text-foreground hover:bg-accent"
            disabled={!canGoToNextPage}
            onClick={() => router.push(createPageURL(currentPage + 1))}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        {/* Per page selector */}
        <div className="flex items-center justify-center space-x-2">
          <span className="text-sm text-muted-foreground">Show</span>
          <Select
            value={perPage.toString()}
            onValueChange={(value) => router.push(createPerPageURL(value))}
          >
            <SelectTrigger className="h-10 w-20 border-border bg-background text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="30">30</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">per page</span>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden items-center justify-between bg-background sm:flex">
        <div className="flex-1 text-sm text-muted-foreground">
          Page {currentPage} of {pageCount}
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          {/* Per page selector */}
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium text-foreground">Rows per page</p>
            <Select
              value={perPage.toString()}
              onValueChange={(value) => router.push(createPerPageURL(value))}
            >
              <SelectTrigger className="h-8 w-[70px] border-border bg-background text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 border-border bg-background p-0 text-foreground hover:bg-accent"
              disabled={!canGoToPreviousPage}
              onClick={() => router.push(createPageURL(currentPage - 1))}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 border-border bg-background p-0 text-foreground hover:bg-accent"
              disabled={!canGoToNextPage}
              onClick={() => router.push(createPageURL(currentPage + 1))}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
