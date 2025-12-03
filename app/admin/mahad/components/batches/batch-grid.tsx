'use client'

import { useMemo } from 'react'

import { format } from 'date-fns'
import { Calendar, Users, Layers, Pencil, Download } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { exportMahadStudentsToVCard } from '@/lib/vcard-export'

import { MahadBatch, MahadStudent } from '../../_types'
import { useMahadUIStore } from '../../store'

interface BatchGridProps {
  batches: MahadBatch[]
  students: MahadStudent[]
}

function BatchCard({
  batch,
  students,
}: {
  batch: MahadBatch
  students: MahadStudent[]
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

  const handleExportContacts = (e: React.MouseEvent) => {
    e.stopPropagation()
    const { exported, skipped, downloadFailed } = exportMahadStudentsToVCard(
      students,
      batch.name
    )
    if (downloadFailed) {
      toast.error('Failed to download file')
      return
    }
    if (exported > 0) {
      const msg =
        skipped > 0
          ? `Exported ${exported} contacts from ${batch.name} (${skipped} skipped)`
          : `Exported ${exported} contacts from ${batch.name}`
      toast.success(msg)
    } else {
      toast.error('No contacts with phone or email to export')
    }
  }

  return (
    <Card
      className="group relative cursor-pointer transition-colors hover:bg-muted/50"
      onClick={handleClick}
    >
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleExportContacts}
          aria-label={`Export contacts from ${batch.name}`}
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleEdit}
          aria-label={`Edit ${batch.name}`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{batch.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{students.length} students</span>
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
  const studentsByBatch = useMemo(() => {
    const map = new Map<string, MahadStudent[]>()
    let unassigned: MahadStudent[] = []
    for (const s of students) {
      if (s.batchId) {
        const list = map.get(s.batchId) ?? []
        list.push(s)
        map.set(s.batchId, list)
      } else {
        unassigned.push(s)
      }
    }
    return { map, unassignedCount: unassigned.length }
  }, [students])

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
          students={studentsByBatch.map.get(batch.id) ?? []}
        />
      ))}
      <UnassignedCard count={studentsByBatch.unassignedCount} />
    </div>
  )
}
