import { Suspense } from 'react'

import Link from 'next/link'

import { CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'


import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { getAllDugsiRegistrations } from '@/lib/services/dugsi'
import { formatGradeLevel } from '@/lib/utils/enum-formatters'
import messages from '@/messages/en.json'

import { SearchableRegistrationsList } from './_components/searchable-registrations-list'
import type { Family } from './_types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Registration Success - Irshād Dugsi',
  description:
    'Your family has been successfully registered for the Dugsi program.',
}

function groupByFamily(
  registrations: Awaited<ReturnType<typeof getAllDugsiRegistrations>>
): Family[] {
  const familyMap = new Map<string, Family>()

  for (const reg of registrations) {
    // Use familyReferenceId as primary key for proper family grouping
    // Fallback to parentEmail or id only if familyReferenceId is missing
    const familyKey = reg.familyReferenceId || reg.parentEmail || reg.id

    if (!familyMap.has(familyKey)) {
      familyMap.set(familyKey, {
        familyKey,
        parent1Name:
          reg.parentFirstName && reg.parentLastName
            ? `${reg.parentFirstName} ${reg.parentLastName}`
            : null,
        parent1Email: reg.parentEmail,
        parent1Phone: reg.parentPhone,
        parent2Name:
          reg.parent2FirstName && reg.parent2LastName
            ? `${reg.parent2FirstName} ${reg.parent2LastName}`
            : null,
        parent2Email: reg.parent2Email,
        parent2Phone: reg.parent2Phone,
        children: [],
        registeredAt: reg.createdAt,
      })
    } else {
      // Update parent 2 info if it exists and wasn't set before
      const family = familyMap.get(familyKey)!
      if (!family.parent2Name && reg.parent2FirstName && reg.parent2LastName) {
        family.parent2Name = `${reg.parent2FirstName} ${reg.parent2LastName}`
        family.parent2Email = reg.parent2Email
        family.parent2Phone = reg.parent2Phone
      }
    }

    const family = familyMap.get(familyKey)!
    family.children.push({
      id: reg.id,
      name: reg.name,
      gradeLevel: reg.gradeLevel ? formatGradeLevel(reg.gradeLevel) : null,
      schoolName: reg.schoolName,
      dateOfBirth: reg.dateOfBirth,
      gender: reg.gender,
      createdAt: reg.createdAt,
    })

    if (reg.createdAt > family.registeredAt) {
      family.registeredAt = reg.createdAt
    }
  }

  return Array.from(familyMap.values()).sort(
    (a, b) => b.registeredAt.getTime() - a.registeredAt.getTime()
  )
}

async function RegistrationsList({
  highlightFamilyId,
}: {
  highlightFamilyId?: string
}) {
  let registrations
  try {
    // Limit to last 50 registrations for performance
    registrations = await getAllDugsiRegistrations(50)
  } catch (error) {
    console.error('Failed to load registrations:', error)
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-12 text-center">
          <p className="text-red-700">{messages.dugsi.success.errorLoading}</p>
        </CardContent>
      </Card>
    )
  }

  const families = groupByFamily(registrations)

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
    <SearchableRegistrationsList
      families={families}
      highlightFamilyId={highlightFamilyId}
    />
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-10 animate-pulse rounded bg-muted" />
              <div className="h-10 animate-pulse rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default async function RegistrationSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ familyId?: string }>
}) {
  const { familyId } = await searchParams

  return (
    <main className="container mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      {familyId && (
        <Card
          className="border-green-200 bg-green-50"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2
                className="h-6 w-6 text-green-600"
                aria-hidden="true"
              />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-green-900">
                {messages.dugsi.success.title}
              </h1>
              <p className="text-green-700">
                {messages.dugsi.success.description}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {messages.dugsi.success.recentRegistrations}
        </h2>
        <Button asChild>
          <Link href="/dugsi/register">
            {messages.dugsi.success.registerAnother}
          </Link>
        </Button>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <RegistrationsList highlightFamilyId={familyId} />
      </Suspense>
    </main>
  )
}
