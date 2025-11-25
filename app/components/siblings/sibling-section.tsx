'use client'

import Link from 'next/link'

import { Users, Plus, ExternalLink } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { SiblingDetails } from '@/lib/db/queries/siblings'

interface SiblingSectionProps {
  personId: string
  siblings: SiblingDetails[]
  onAddSibling?: () => void
}

export function SiblingSection({
  personId: _personId,
  siblings,
  onAddSibling,
}: SiblingSectionProps) {
  if (siblings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>Siblings</CardTitle>
            </div>
            {onAddSibling && (
              <Button variant="outline" size="sm" onClick={onAddSibling}>
                <Plus className="mr-2 h-4 w-4" />
                Add Sibling
              </Button>
            )}
          </div>
          <CardDescription>No siblings found</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const programsAcrossSiblings = new Set<string>()
  siblings.forEach((sibling) => {
    sibling.profiles.forEach((profile) => {
      programsAcrossSiblings.add(profile.program)
    })
  })

  const discountEligible =
    siblings.length >= 1 && programsAcrossSiblings.size >= 1

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Siblings ({siblings.length})</CardTitle>
            {discountEligible && (
              <Badge variant="secondary" className="ml-2">
                Discount Eligible
              </Badge>
            )}
          </div>
          {onAddSibling && (
            <Button variant="outline" size="sm" onClick={onAddSibling}>
              <Plus className="mr-2 h-4 w-4" />
              Add Sibling
            </Button>
          )}
        </div>
        <CardDescription>
          Siblings across all programs:{' '}
          {Array.from(programsAcrossSiblings).join(', ')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {siblings.map((sibling) => (
            <div
              key={sibling.relationshipId}
              className="flex items-start justify-between rounded-lg border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-medium">{sibling.person.name}</span>
                  {sibling.confidence && sibling.confidence < 0.9 && (
                    <Badge variant="outline" className="text-xs">
                      {Math.round(sibling.confidence * 100)}% confidence
                    </Badge>
                  )}
                  {sibling.detectionMethod === 'MANUAL' && (
                    <Badge variant="default" className="text-xs">
                      Verified
                    </Badge>
                  )}
                </div>

                {sibling.profiles.length > 0 ? (
                  <div className="space-y-1">
                    {sibling.profiles.map((profile) => (
                      <div
                        key={profile.id}
                        className="text-sm text-muted-foreground"
                      >
                        <Badge variant="outline" className="mr-2">
                          {profile.program.replace('_PROGRAM', '')}
                        </Badge>
                        {profile.enrollments.length > 0 && (
                          <span className="text-xs">
                            {profile.enrollments[0].status.toLowerCase()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No active enrollments
                  </p>
                )}
              </div>

              <Link href={`/admin/persons/${sibling.person.id}`}>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
