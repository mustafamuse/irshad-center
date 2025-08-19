'use client'

import { useEffect } from 'react'

import { Loader2 } from 'lucide-react'

import { DuplicateGroupCard } from './duplicate-group-card'
import { useStudents } from '../../../_hooks/use-students'

export function DuplicatesList() {
  const { getDuplicates, duplicates, isGettingDuplicates } = useStudents()

  useEffect(() => {
    // Load duplicates when component mounts
    getDuplicates()
  }, [getDuplicates])

  if (isGettingDuplicates) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Scanning for duplicates...</span>
        </div>
      </div>
    )
  }

  if (!duplicates || duplicates.length === 0) {
    return (
      <div className="text-center text-muted-foreground">
        <p>No duplicate student records found.</p>
        <p className="text-sm">All student records appear to be unique.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {duplicates.length} duplicate group
          {duplicates.length !== 1 ? 's' : ''} found
        </p>
      </div>

      <div className="space-y-3">
        {duplicates.map((group: any) => (
          <DuplicateGroupCard key={group.email} group={group} />
        ))}
      </div>
    </div>
  )
}
