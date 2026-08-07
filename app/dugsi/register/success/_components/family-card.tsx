import { Gender } from '@prisma/client'
import { Users, GraduationCap, Phone, Mail } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import messages from '@/messages/en.json'

import type { Family } from '../_types'

export type { Family }

function formatNameAsLastNameFirst(fullName: string): string {
  if (!fullName || !fullName.trim()) {
    return fullName
  }

  const trimmed = fullName.trim()
  const parts = trimmed.split(/\s+/)

  if (parts.length === 0) {
    return fullName
  }

  if (parts.length === 1) {
    return parts[0]
  }

  // First word is firstName, rest is lastName
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')

  return `${lastName}, ${firstName}`
}

function getGenderEmoji(gender: Gender | null): string {
  switch (gender) {
    case 'MALE':
      return '👦🏽'
    case 'FEMALE':
      return '👧🏽'
    default:
      return ''
  }
}

interface FamilyCardProps {
  family: Family
  isHighlighted: boolean
}

export function FamilyCard({ family, isHighlighted }: FamilyCardProps) {
  return (
    <Card
      className={
        isHighlighted ? 'border-2 border-green-500 bg-green-50/50' : ''
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users
                className="h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
              {family.parent1Name || 'Family'}
              {isHighlighted && (
                <span
                  className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                  aria-label={messages.dugsi.success.justRegistered}
                >
                  {messages.dugsi.success.justRegistered}
                </span>
              )}
            </CardTitle>
            <div className="mt-2 space-y-2">
              {/* Parent 1 */}
              <div>
                {family.parent1Name && (
                  <div className="text-sm font-medium text-foreground">
                    Parent 1: {family.parent1Name}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {family.parent1MaskedEmail && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                      {family.parent1MaskedEmail}
                    </span>
                  )}
                  {family.parent1MaskedPhone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      {family.parent1MaskedPhone}
                    </span>
                  )}
                </div>
              </div>
              {/* Parent 2 */}
              {family.parent2Name && (
                <div>
                  <div className="text-sm font-medium text-foreground">
                    Parent 2: {family.parent2Name}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {family.parent2MaskedEmail && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                        {family.parent2MaskedEmail}
                      </span>
                    )}
                    {family.parent2MaskedPhone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                        {family.parent2MaskedPhone}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <time
            className="ml-4 text-xs text-muted-foreground"
            dateTime={family.registeredAt.toISOString()}
          >
            {new Intl.DateTimeFormat('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }).format(family.registeredAt)}
          </time>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {family.children.map((child) => {
            const age = child.ageYears !== null ? `${child.ageYears} yrs` : null
            const genderEmoji = getGenderEmoji(child.gender)
            const formattedName = formatNameAsLastNameFirst(child.name)

            return (
              <div
                key={child.id}
                className="flex flex-col gap-1.5 rounded-lg bg-muted/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <GraduationCap
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    {genderEmoji && (
                      <span
                        className="text-base leading-none"
                        aria-hidden="true"
                      >
                        {genderEmoji}
                      </span>
                    )}
                    <span className="truncate font-medium">
                      {formattedName}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:gap-3 sm:text-sm">
                  {age && <span className="shrink-0">{age}</span>}
                  {child.gradeLevel && (
                    <span className="shrink-0">{child.gradeLevel}</span>
                  )}
                  {child.schoolName && (
                    <span className="max-w-[120px] truncate sm:max-w-[150px]">
                      {child.schoolName}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
