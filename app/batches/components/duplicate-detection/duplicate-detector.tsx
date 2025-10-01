'use client'

import React from 'react'

import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { DuplicatesList } from './duplicates-list'
import { useUIStore } from '../../store/ui-store'

export function DuplicateDetector() {
  const { duplicatesExpanded, setDuplicatesExpanded } = useUIStore()

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm sm:p-4 lg:p-6">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <div className="flex items-start gap-2 sm:items-center">
          <AlertCircle className="h-4 w-4 text-orange-500 sm:h-5 sm:w-5" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold sm:text-lg">
              Duplicate Student Records
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Review and manage duplicate student entries
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDuplicatesExpanded(!duplicatesExpanded)}
          className="w-full sm:w-auto"
        >
          {duplicatesExpanded ? (
            <>
              <span className="mr-2">Hide</span>
              <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              <span className="mr-2">Show</span>
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {duplicatesExpanded && (
        <div className="mt-3 rounded-md border bg-amber-50/50 p-3 sm:mt-4 sm:p-4">
          <DuplicatesList />
        </div>
      )}
    </div>
  )
}
