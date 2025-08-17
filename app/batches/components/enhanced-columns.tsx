'use client'

import { ColumnDef } from '@tanstack/react-table'

import { Badge } from '@/components/ui/badge'
import { BatchStudentData } from '@/lib/actions/get-batch-data'
import { getBatchStyle } from '@/lib/config/batch-styles'

import { CopyableText } from './copyable-text'
import { SearchMatch } from './filters/enhanced-use-filtered-students'

// Enhanced student data type with search matches
type EnhancedStudentData = BatchStudentData & {
  searchMatches?: SearchMatch[]
}

// Highlighted text component
function HighlightedText({
  text,
  ranges,
}: {
  text: string
  ranges: { start: number; end: number }[]
}) {
  if (!ranges.length) return <span>{text}</span>

  const parts: { text: string; isHighlight: boolean }[] = []
  let lastIndex = 0

  ranges.forEach(({ start, end }) => {
    if (start > lastIndex) {
      parts.push({ text: text.slice(lastIndex, start), isHighlight: false })
    }
    parts.push({ text: text.slice(start, end), isHighlight: true })
    lastIndex = end
  })

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isHighlight: false })
  }

  return (
    <span>
      {parts.map((part, index) =>
        part.isHighlight ? (
          <mark
            key={index}
            className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-900"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  )
}

export const enhancedColumns: ColumnDef<EnhancedStudentData>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const student = row.original
      const nameMatch = student.searchMatches?.find(
        (match) => match.field === 'name'
      )

      return (
        <div
          className="max-w-[200px] truncate font-medium"
          title={student.name}
        >
          {nameMatch ? (
            <HighlightedText
              text={student.name}
              ranges={nameMatch.highlightRanges}
            />
          ) : (
            student.name
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => {
      const student = row.original
      const emailMatch = student.searchMatches?.find(
        (match) => match.field === 'email'
      )

      if (!student.email) {
        return <span className="text-muted-foreground">-</span>
      }

      return (
        <CopyableText
          text={student.email}
          label="email"
          className="max-w-[200px]"
        >
          <span className="truncate" title={student.email}>
            {emailMatch ? (
              <HighlightedText
                text={student.email}
                ranges={emailMatch.highlightRanges}
              />
            ) : (
              student.email
            )}
          </span>
        </CopyableText>
      )
    },
  },
  {
    accessorKey: 'phone',
    header: 'Phone',
    cell: ({ row }) => {
      const student = row.original
      const phoneMatch = student.searchMatches?.find(
        (match) => match.field === 'phone'
      )
      const phone = student.phone

      if (!phone) return <span className="text-muted-foreground">-</span>

      const formatted = phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')

      return (
        <CopyableText
          text={phone}
          label="phone number"
          className="whitespace-nowrap"
        >
          <span className="font-mono">
            {phoneMatch ? (
              <HighlightedText
                text={formatted}
                ranges={phoneMatch.highlightRanges}
              />
            ) : (
              formatted
            )}
          </span>
        </CopyableText>
      )
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
