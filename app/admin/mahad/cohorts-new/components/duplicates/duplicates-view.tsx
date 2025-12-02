'use client'

import { AlertTriangle, Mail, Phone, CheckCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { DuplicateGroup } from '../../_types'

interface DuplicatesViewProps {
  duplicates: DuplicateGroup[]
}

function DuplicateCard({ group }: { group: DuplicateGroup }) {
  const Icon = group.matchType === 'email' ? Mail : Phone
  const label = group.matchType === 'email' ? 'Email match' : 'Phone match'

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            <Badge variant="outline" className="gap-1">
              <Icon className="h-3 w-3" />
              {label}
            </Badge>
          </CardTitle>
          <Badge variant="secondary">{group.students.length} students</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {group.students.map((student) => (
            <li
              key={student.id}
              className="flex items-center justify-between rounded-md bg-muted/50 p-2 text-sm"
            >
              <span className="font-medium">{student.name}</span>
              <span className="text-muted-foreground">
                {student.batch?.name || 'Unassigned'}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export function DuplicatesView({ duplicates }: DuplicatesViewProps) {
  if (duplicates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <h3 className="mt-4 text-lg font-semibold">No duplicates detected</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          All students appear to be unique based on email and phone.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <div>
          <p className="font-medium text-amber-700 dark:text-amber-400">
            {duplicates.length} potential duplicate groups found
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-500">
            Review these students and merge or remove duplicates as needed.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {duplicates.map((group) => (
          <DuplicateCard key={group.key} group={group} />
        ))}
      </div>
    </div>
  )
}
