'use client'

import { memo, useEffect, useState } from 'react'

import { Loader2, Search, User } from 'lucide-react'

import { ErrorAlert } from '@/app/admin/_components/error-alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'


import {
  createTeacherAction,
  searchPeopleAction,
  type PersonSearchResult,
} from '../actions'

interface Props {
  onSuccess?: () => void
}

/**
 * Displays role badges and details for a person search result.
 * Shows:
 * - Teacher: programs they teach
 * - Student: enrolled programs and status
 * - Parent: number of children and their program breakdown
 *
 * @param person - Person search result with role details
 */
const RoleDisplay = memo(function RoleDisplay({
  person,
}: {
  person: PersonSearchResult
}) {
  const { roleDetails } = person

  return (
    <div className="space-y-1">
      {roleDetails.teacher && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Teacher:</span>
          <div className="flex gap-1">
            {roleDetails.teacher.programs.map((program) => (
              <Badge key={program} variant="default" className="text-xs">
                {program.replace('_PROGRAM', '')}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {roleDetails.student && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Student:</span>
          <div className="flex gap-1">
            {roleDetails.student.programs.map(({ program, status }) => (
              <Badge
                key={program}
                variant={status === 'ENROLLED' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {program.replace('_PROGRAM', '')}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {roleDetails.parent && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Parent:</span>
          <span className="text-xs text-muted-foreground">
            {roleDetails.parent.childCount}{' '}
            {roleDetails.parent.childCount === 1 ? 'child' : 'children'}
            {roleDetails.parent.programBreakdown.length > 0 && (
              <>
                {' '}
                in{' '}
                {roleDetails.parent.programBreakdown
                  .map(
                    (pb) =>
                      `${pb.program.replace('_PROGRAM', '')} (${pb.count})`
                  )
                  .join(', ')}
              </>
            )}
          </span>
        </div>
      )}

      {!roleDetails.teacher && !roleDetails.student && !roleDetails.parent && (
        <Badge variant="outline" className="text-xs">
          No roles assigned
        </Badge>
      )}
    </div>
  )
})

/**
 * Search tab for finding people by name, email, or phone.
 * Displays search results with role information (teacher, student, parent).
 * Allows promoting non-teachers to teacher role.
 *
 * @param onSuccess - Callback fired when a person is promoted to teacher
 */
export function SearchPersonTab({ onSuccess }: Props) {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<PersonSearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [promotingId, setPromotingId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([])
        return
      }

      setIsSearching(true)
      setError(null)
      const result = await searchPeopleAction(query)

      if (result.success && result.data) {
        setResults(result.data)
      } else if (!result.success) {
        setError(result.error || 'Search failed')
      }
      setIsSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  async function handlePromoteToTeacher(personId: string) {
    setPromotingId(personId)
    setError(null)

    const result = await createTeacherAction({ personId })

    setPromotingId(null)

    if (result.success) {
      onSuccess?.()
    } else {
      setError(result.error || 'Failed to promote to teacher')
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {isSearching && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isSearching && results.length === 0 && query.trim().length >= 2 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No people found matching &quot;{query}&quot;
          </p>
        </div>
      )}

      {!isSearching && query.trim().length < 2 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Type at least 2 characters to search
          </p>
        </div>
      )}

      {!isSearching && results.length > 0 && (
        <div className="space-y-2">
          {results.map((person) => (
            <div
              key={person.id}
              className="flex items-start justify-between rounded-lg border p-3 hover:bg-accent/50"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{person.name}</p>
                    {person.isTeacher && (
                      <Badge variant="secondary" className="text-xs">
                        Already a Teacher
                      </Badge>
                    )}
                  </div>
                  <RoleDisplay person={person} />
                  {person.email && (
                    <p className="text-sm text-muted-foreground">
                      {person.email}
                    </p>
                  )}
                  {person.phone && (
                    <p className="text-sm text-muted-foreground">
                      {person.phone}
                    </p>
                  )}
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => handlePromoteToTeacher(person.id)}
                disabled={person.isTeacher || promotingId === person.id}
              >
                {promotingId === person.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Promoting...
                  </>
                ) : person.isTeacher ? (
                  'Already Teacher'
                ) : (
                  'Make Teacher'
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {error && <ErrorAlert message={error} />}
    </div>
  )
}
