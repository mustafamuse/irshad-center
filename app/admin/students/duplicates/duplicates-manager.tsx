'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Users, CheckCircle, XCircle } from 'lucide-react'
import type { Student } from '@prisma/client'
import { DuplicateDetector } from '@/app/admin/mahad/cohorts/components/duplicate-detection/duplicate-detector'

interface DuplicatesManagerProps {
  duplicates: Array<{ name: string; students: Student[] }>
}

export function DuplicatesManager({ duplicates }: DuplicatesManagerProps) {
  const [resolvedCount, setResolvedCount] = useState(0)

  const handleResolved = () => {
    setResolvedCount(prev => prev + 1)
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{duplicates.length}</p>
              <p className="text-sm text-muted-foreground">Duplicate Groups</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {duplicates.reduce((sum, group) => sum + group.students.length, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Records</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{resolvedCount}</p>
              <p className="text-sm text-muted-foreground">Resolved Today</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Duplicates Detection */}
      {duplicates.length > 0 ? (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-semibold">Duplicate Records Detected</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Review and resolve duplicate student records to maintain data integrity.
              Each group shows students with the same name that might be duplicates.
            </p>

            <DuplicateDetector duplicates={duplicates as any} />
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-green-100 p-4 dark:bg-green-900">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold">No Duplicates Found</h3>
            <p className="text-muted-foreground">
              All student records are unique. No duplicates detected at this time.
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}