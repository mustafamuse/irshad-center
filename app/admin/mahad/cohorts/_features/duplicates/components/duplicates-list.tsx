'use client'

import { DuplicateGroup } from '@/lib/types/batch'

import { DuplicateGroupCard } from './duplicate-group-card'

interface DuplicatesListProps {
  duplicates: DuplicateGroup[]
}

export function DuplicatesList({ duplicates }: DuplicatesListProps) {
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
        {duplicates.map((group: DuplicateGroup) => (
          <DuplicateGroupCard key={group.email} group={group} />
        ))}
      </div>
    </div>
  )
}
