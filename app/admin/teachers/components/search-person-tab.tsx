'use client'

import { useEffect, useState } from 'react'

import { Loader2, Search, User } from 'lucide-react'

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

      if (result.success) {
        setResults(result.data)
      } else {
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

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </div>
  )
}
