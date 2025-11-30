'use client'

import { useState, useMemo } from 'react'

import { Search } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import messages from '@/messages/en.json'

import { FamilyCard, type Family } from './family-card'

interface SearchableRegistrationsListProps {
  families: Family[]
  highlightFamilyId?: string
}

function filterFamiliesBySearch(families: Family[], query: string): Family[] {
  if (!query.trim()) return families

  const normalizedQuery = query.toLowerCase().trim()
  const searchDigits = query.replace(/\D/g, '')
  const isEmailSearch = normalizedQuery.includes('@')
  const isPhoneSearch = searchDigits.length >= 4

  return families.filter((family) => {
    // Search parent 1
    const parent1Name = family.parent1Name?.toLowerCase() || ''
    const parent1Email = family.parent1Email?.toLowerCase() || ''
    const parent1Phone = family.parent1Phone?.replace(/\D/g, '') || ''

    // Search parent 2
    const parent2Name = family.parent2Name?.toLowerCase() || ''
    const parent2Email = family.parent2Email?.toLowerCase() || ''
    const parent2Phone = family.parent2Phone?.replace(/\D/g, '') || ''

    // Email search
    if (isEmailSearch) {
      return (
        parent1Email.includes(normalizedQuery) ||
        parent2Email.includes(normalizedQuery)
      )
    }

    // Phone search (match last 4 digits)
    if (isPhoneSearch) {
      const searchLast4 = searchDigits.slice(-4)
      return (
        parent1Phone.endsWith(searchLast4) || parent2Phone.endsWith(searchLast4)
      )
    }

    // Name search (searches both parents)
    return (
      parent1Name.includes(normalizedQuery) ||
      parent2Name.includes(normalizedQuery) ||
      parent1Email.includes(normalizedQuery) ||
      parent2Email.includes(normalizedQuery)
    )
  })
}

export function SearchableRegistrationsList({
  families,
  highlightFamilyId,
}: SearchableRegistrationsListProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredFamilies = useMemo(
    () => filterFamiliesBySearch(families, searchQuery),
    [families, searchQuery]
  )

  if (families.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            {messages.dugsi.success.noRegistrations}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by parent name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          aria-label="Search families by parent name, email, or phone"
        />
      </div>

      {filteredFamilies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No families found matching &quot;{searchQuery}&quot;
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredFamilies.map((family) => {
            const isHighlighted =
              highlightFamilyId !== undefined &&
              family.familyKey === highlightFamilyId

            return (
              <FamilyCard
                key={family.familyKey}
                family={family}
                isHighlighted={isHighlighted}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
