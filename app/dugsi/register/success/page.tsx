import { Suspense } from 'react'

import Link from 'next/link'

import { CheckCircle2, Users, GraduationCap, Phone, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAllDugsiRegistrations } from '@/lib/services/dugsi'
import { formatGradeLevel } from '@/lib/utils/enum-formatters'

export const dynamic = 'force-dynamic'

interface Family {
  familyKey: string
  parentName: string | null
  parentEmail: string | null
  parentPhone: string | null
  children: Array<{
    id: string
    name: string
    gradeLevel: string | null
    schoolName: string | null
    createdAt: Date
  }>
  registeredAt: Date
}

function groupByFamily(
  registrations: Awaited<ReturnType<typeof getAllDugsiRegistrations>>
): Family[] {
  const familyMap = new Map<string, Family>()

  for (const reg of registrations) {
    const familyKey = reg.familyReferenceId || reg.parentEmail || reg.id

    if (!familyMap.has(familyKey)) {
      familyMap.set(familyKey, {
        familyKey,
        parentName:
          reg.parentFirstName && reg.parentLastName
            ? `${reg.parentFirstName} ${reg.parentLastName}`
            : null,
        parentEmail: reg.parentEmail,
        parentPhone: reg.parentPhone,
        children: [],
        registeredAt: reg.createdAt,
      })
    }

    const family = familyMap.get(familyKey)!
    family.children.push({
      id: reg.id,
      name: reg.name,
      gradeLevel: reg.gradeLevel ? formatGradeLevel(reg.gradeLevel) : null,
      schoolName: reg.schoolName,
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

function FamilyCard({
  family,
  isHighlighted,
}: {
  family: Family
  isHighlighted: boolean
}) {
  return (
    <Card
      className={
        isHighlighted ? 'border-2 border-green-500 bg-green-50/50' : ''
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-muted-foreground" />
              {family.parentName || 'Family'}
              {isHighlighted && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Just Registered
                </span>
              )}
            </CardTitle>
            <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
              {family.parentEmail && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {family.parentEmail}
                </span>
              )}
              {family.parentPhone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {family.parentPhone}
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {family.registeredAt.toLocaleDateString()}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {family.children.map((child) => (
            <div
              key={child.id}
              className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{child.name}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {child.gradeLevel && <span>{child.gradeLevel}</span>}
                {child.schoolName && (
                  <span className="max-w-[150px] truncate">
                    {child.schoolName}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

async function RegistrationsList({
  highlightFamilyId,
}: {
  highlightFamilyId?: string
}) {
  const registrations = await getAllDugsiRegistrations()
  const families = groupByFamily(registrations)

  if (families.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No registrations yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {families.map((family) => (
        <FamilyCard
          key={family.familyKey}
          family={family}
          isHighlighted={family.familyKey === highlightFamilyId}
        />
      ))}
    </div>
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
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-green-900">
                Registration Successful!
              </h1>
              <p className="text-green-700">
                Your family has been registered for the Dugsi program.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Recent Registrations</h2>
        <Button asChild>
          <Link href="/dugsi/register">Register Another Family</Link>
        </Button>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <RegistrationsList highlightFamilyId={familyId} />
      </Suspense>
    </main>
  )
}
