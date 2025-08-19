'use client'

import { useState } from 'react'

import { Trash2, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

import { ResolutionDialog } from './resolution-dialog'
import { useStudents } from '../../../_hooks/use-students'
import { DuplicateGroup } from '../../../_types'

interface DuplicateGroupCardProps {
  group: DuplicateGroup
}

export function DuplicateGroupCard({ group }: DuplicateGroupCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showResolutionDialog, setShowResolutionDialog] = useState(false)
  const { isResolvingDuplicates } = useStudents()

  const totalRecords = 1 + group.duplicateRecords.length

  return (
    <>
      <Card className="p-4">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-orange-500" />
              <div>
                <p className="font-medium">{group.email}</p>
                <p className="text-sm text-muted-foreground">
                  {totalRecords} duplicate records
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {group.hasSiblingGroup && (
                <Badge variant="secondary" className="text-xs">
                  Has Siblings
                </Badge>
              )}
              {group.hasRecentActivity && (
                <Badge variant="outline" className="text-xs">
                  Recent Activity
                </Badge>
              )}

              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowResolutionDialog(true)}
                disabled={isResolvingDuplicates}
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>

              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isOpen ? 'Hide' : 'View'} Details
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          <CollapsibleContent className="mt-4">
            <div className="space-y-3">
              <div>
                <h4 className="mb-2 text-sm font-medium text-green-600">
                  Record to Keep
                </h4>
                <div className="rounded-md bg-green-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{group.keepRecord.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Created:{' '}
                        {new Date(
                          group.keepRecord.createdAt
                        ).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Status: {group.keepRecord.status}
                      </p>
                    </div>
                    <Badge variant="secondary">Keep</Badge>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium text-red-600">
                  Records to Delete ({group.duplicateRecords.length})
                </h4>
                <div className="space-y-2">
                  {group.duplicateRecords.map((record) => (
                    <div key={record.id} className="rounded-md bg-red-50 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{record.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Created:{' '}
                            {new Date(record.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Status: {record.status}
                          </p>
                        </div>
                        <Badge variant="destructive">Delete</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <ResolutionDialog
        group={group}
        open={showResolutionDialog}
        onOpenChange={setShowResolutionDialog}
      />
    </>
  )
}
