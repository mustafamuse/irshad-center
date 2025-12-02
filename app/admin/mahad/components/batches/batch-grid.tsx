'use client'

import { format } from 'date-fns'
import { Calendar, Users, Layers, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { MahadBatch, MahadStudent } from '../../_types'
import { useMahadUIStore } from '../../store'

interface BatchGridProps {
  batches: MahadBatch[]
  students: MahadStudent[]
}

function BatchCard({
  batch,
  studentCount,
}: {
  batch: MahadBatch
  studentCount: number
}) {
  const setBatchFilter = useMahadUIStore((s) => s.setBatchFilter)
  const setActiveTab = useMahadUIStore((s) => s.setActiveTab)
  const openDialogWithData = useMahadUIStore((s) => s.openDialogWithData)

  const handleClick = () => {
    setBatchFilter(batch.id)
    setActiveTab('students')
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    openDialogWithData('editBatch', batch)
  }

  return (
    <Card
      className="group relative cursor-pointer transition-colors hover:bg-muted/50"
      onClick={handleClick}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={handleEdit}
        aria-label={`Edit ${batch.name}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{batch.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{studentCount} students</span>
        </div>
        {batch.startDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Started {format(batch.startDate, 'MMM yyyy')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function UnassignedCard({ count }: { count: number }) {
  const setBatchFilter = useMahadUIStore((s) => s.setBatchFilter)
  const setActiveTab = useMahadUIStore((s) => s.setActiveTab)

  const handleClick = () => {
    setBatchFilter('unassigned')
    setActiveTab('students')
  }

  if (count === 0) return null

  return (
    <Card
      className="cursor-pointer border-dashed transition-colors hover:bg-muted/50"
      onClick={handleClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-muted-foreground">
          Unassigned
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{count} students need batch assignment</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function BatchGrid({ batches, students }: BatchGridProps) {
  const unassignedCount = students.filter((s) => !s.batchId).length

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <Layers className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No batches yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first batch to start organizing students.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {batches.map((batch) => (
        <BatchCard
          key={batch.id}
          batch={batch}
          studentCount={batch.studentCount}
        />
      ))}
      <UnassignedCard count={unassignedCount} />
    </div>
  )
}
