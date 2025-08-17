'use client'

import { ColumnDef } from '@tanstack/react-table'

import { Badge } from '@/components/ui/badge'
import { BatchStudentData } from '@/lib/actions/get-batch-data'
import { getBatchStyle } from '@/lib/config/batch-styles'

export const columns: ColumnDef<BatchStudentData>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div
        className="max-w-[200px] truncate font-medium"
        title={row.original.name}
      >
        {row.original.name}
      </div>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => (
      <div
        className="max-w-[200px] truncate"
        title={row.original.email || undefined}
      >
        {row.original.email}
      </div>
    ),
  },
  {
    accessorKey: 'phone',
    header: 'Phone',
    cell: ({ row }) => {
      const phone = row.original.phone
      if (!phone) return <span className="text-muted-foreground">-</span>

      const formatted = phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
      return <span className="whitespace-nowrap font-mono">{formatted}</span>
    },
  },
  {
    accessorKey: 'batch',
    header: 'Batch',
    cell: ({ row }) => {
      const batch = row.original.batch
      if (!batch)
        return <span className="text-xs text-muted-foreground">Unassigned</span>

      const style = getBatchStyle(batch.name)

      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Badge
            variant={style.variant}
            className={`px-2 py-0.5 text-xs font-medium ${style.className}`}
          >
            {batch.name}
          </Badge>
        </div>
      )
    },
  },
  {
    accessorKey: 'siblingGroup',
    header: 'Siblings',
    cell: ({ row }) => {
      const siblings = row.original.siblingGroup?.students.filter(
        (s) => s.id !== row.original.id
      )

      return siblings?.length ? (
        <div className="flex items-center gap-1 whitespace-nowrap">
          <Badge variant="outline" className="text-xs">
            {siblings.length} {siblings.length === 1 ? 'sibling' : 'siblings'}
          </Badge>
        </div>
      ) : (
        <span className="text-muted-foreground">None</span>
      )
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.status === 'registered'
            ? 'default'
            : row.original.status === 'enrolled'
              ? 'secondary'
              : 'outline'
        }
        className="whitespace-nowrap"
      >
        {row.original.status}
      </Badge>
    ),
  },
]
