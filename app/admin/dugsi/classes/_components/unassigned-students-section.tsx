'use client'

import { useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'

import { UserRoundX } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { ClassWithDetails, UnassignedStudent } from '../../_types'
import { bulkEnrollStudentsAction } from '../../actions'

type Sibling = UnassignedStudent['siblings'][number]

const MAX_SIBLINGS_SHOWN = 2

export function formatSiblings(
  studentName: string,
  siblings: Sibling[]
): string {
  const studentLast = studentName.split(' ').slice(1).join(' ')

  const groups = new Map<string, string[]>()
  for (const s of siblings) {
    const sibLast = s.name.split(' ').slice(1).join(' ')
    const useFirstNameOnly = studentLast !== '' && sibLast === studentLast
    const displayName = useFirstNameOnly ? s.name.split(' ')[0] : s.name
    const shift = s.classShift === 'MORNING' ? 'AM' : 'PM'
    const key = `${s.teacherName.split(' ')[0]}, ${shift}`
    const list = groups.get(key) ?? []
    list.push(displayName)
    groups.set(key, list)
  }

  let shown = 0
  const parts: string[] = []
  groups.forEach((names, key) => {
    if (shown >= MAX_SIBLINGS_SHOWN) return
    const take = Math.min(names.length, MAX_SIBLINGS_SHOWN - shown)
    parts.push(`${names.slice(0, take).join(', ')} (${key})`)
    shown += take
  })

  const remaining = siblings.length - shown
  const suffix = remaining > 0 ? ` +${remaining} more` : ''

  return `${parts.join(', ')}${suffix}`
}

interface UnassignedStudentsSectionProps {
  students: UnassignedStudent[]
  classes: ClassWithDetails[]
}

export function UnassignedStudentsSection({
  students,
  classes,
}: UnassignedStudentsSectionProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [classId, setClassId] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const sorted = useMemo(
    () =>
      [...students].sort((a, b) => {
        if (a.siblings.length !== b.siblings.length) {
          return b.siblings.length - a.siblings.length
        }
        return a.name.localeCompare(b.name)
      }),
    [students]
  )

  const allSelected = sorted.length > 0 && selected.size === sorted.length

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sorted.map((s) => s.profileId)))
    }
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelected(next)
  }

  const handleAssign = async () => {
    if (selected.size === 0 || !classId) return

    setIsLoading(true)
    try {
      const result = await bulkEnrollStudentsAction({
        classId,
        programProfileIds: Array.from(selected),
      })

      if (result.success) {
        toast.success(result.message || `Assigned ${selected.size} students`)
        setSelected(new Set())
        setClassId('')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('Something went wrong assigning students. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const morningClasses = useMemo(
    () => classes.filter((c) => c.shift === 'MORNING'),
    [classes]
  )
  const afternoonClasses = useMemo(
    () => classes.filter((c) => c.shift === 'AFTERNOON'),
    [classes]
  )

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserRoundX className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">
            Unassigned Students ({students.length})
          </CardTitle>
        </div>
        <CardDescription>
          Select students below, then choose a class to assign them
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label="Select all students"
            />
            <span className="text-sm text-muted-foreground">
              {allSelected
                ? `Deselect All (${sorted.length})`
                : `Select All (${sorted.length})`}
            </span>
          </div>
          <ScrollArea className="max-h-80">
            {sorted.map((student) => (
              <label
                key={student.profileId}
                className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-muted/50"
              >
                <Checkbox
                  checked={selected.has(student.profileId)}
                  onCheckedChange={() => toggle(student.profileId)}
                  aria-label={`Select ${student.name}`}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-medium">{student.name}</span>
                    {student.age !== null && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">
                          {student.age}
                        </span>
                      </>
                    )}
                    {(student.age !== null || student.shift) && (
                      <span className="text-muted-foreground">·</span>
                    )}
                    {student.shift ? (
                      <span className="text-muted-foreground">
                        {student.shift === 'MORNING' ? 'AM' : 'PM'}
                      </span>
                    ) : (
                      <span className="text-amber-600">No shift</span>
                    )}
                  </div>
                  {student.siblings.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Sibling: {formatSiblings(student.name, student.siblings)}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </ScrollArea>
        </div>

        <div className="space-y-3">
          {selected.size > 0 && (
            <p className="text-sm text-muted-foreground">
              {selected.size} of {sorted.length} selected
            </p>
          )}
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger aria-label="Select a class">
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              {morningClasses.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Morning</SelectLabel>
                  {morningClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.studentCount} students)
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {afternoonClasses.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Afternoon</SelectLabel>
                  {afternoonClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.studentCount} students)
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>

          <Button
            className="w-full bg-[#007078] hover:bg-[#005a61]"
            disabled={selected.size === 0 || !classId || isLoading}
            onClick={handleAssign}
          >
            {isLoading
              ? 'Assigning\u2026'
              : selected.size > 0 && !classId
                ? 'Select a class first'
                : `Assign ${selected.size} Student${selected.size !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
