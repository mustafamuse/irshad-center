'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { BatchStudentData } from '@/lib/actions/get-batch-data'
import { getBatchStyle } from '@/lib/config/batch-styles'

import { ClickableCopyableText } from './copyable-text'
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

interface MobileStudentCardProps {
  student: EnhancedStudentData
}

export function MobileStudentCard({ student }: MobileStudentCardProps) {
  const nameMatch = student.searchMatches?.find(
    (match) => match.field === 'name'
  )
  const emailMatch = student.searchMatches?.find(
    (match) => match.field === 'email'
  )
  const phoneMatch = student.searchMatches?.find(
    (match) => match.field === 'phone'
  )

  const batch = student.batch
  const batchStyle = batch ? getBatchStyle(batch.name) : null
  const siblings = student.siblingGroup?.students.filter(
    (s) => s.id !== student.id
  )

  return (
    <Card className="space-y-3 p-4">
      {/* Header - Name and Status */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-medium" title={student.name}>
            {nameMatch ? (
              <HighlightedText
                text={student.name}
                ranges={nameMatch.highlightRanges}
              />
            ) : (
              student.name
            )}
          </h3>
          <Badge
            variant={
              student.status === 'registered'
                ? 'default'
                : student.status === 'enrolled'
                  ? 'secondary'
                  : 'outline'
            }
            className="mt-1 text-xs"
          >
            {student.status}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Contact Information */}
      <div className="space-y-1">
        {student.email && (
          <ClickableCopyableText
            text={student.email}
            label="email"
            className="rounded-md hover:bg-muted/30"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Email:</span>
              <span
                className="max-w-[200px] truncate text-sm"
                title={student.email}
              >
                {emailMatch ? (
                  <HighlightedText
                    text={student.email}
                    ranges={emailMatch.highlightRanges}
                  />
                ) : (
                  student.email
                )}
              </span>
            </div>
          </ClickableCopyableText>
        )}

        {student.phone && (
          <ClickableCopyableText
            text={student.phone}
            label="phone number"
            className="rounded-md hover:bg-muted/30"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Phone:</span>
              <span className="font-mono text-sm">
                {phoneMatch ? (
                  <HighlightedText
                    text={student.phone.replace(
                      /(\d{3})(\d{3})(\d{4})/,
                      '($1) $2-$3'
                    )}
                    ranges={phoneMatch.highlightRanges}
                  />
                ) : (
                  student.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
                )}
              </span>
            </div>
          </ClickableCopyableText>
        )}
      </div>

      <Separator />

      {/* Batch and Siblings */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Batch:</span>
          {batch ? (
            <Badge
              variant={batchStyle?.variant || 'outline'}
              className={`text-xs ${batchStyle?.className || ''}`}
            >
              {batch.name}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Unassigned</span>
          )}
        </div>

        {siblings && siblings.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Siblings:</span>
            <Badge variant="outline" className="text-xs">
              {siblings.length} {siblings.length === 1 ? 'sibling' : 'siblings'}
            </Badge>
          </div>
        )}
      </div>
    </Card>
  )
}
