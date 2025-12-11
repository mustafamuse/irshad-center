import { ProgramBadges } from '@/app/admin/_components/program-badges'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

import type { PersonLookupResult } from '../actions'

interface TeacherRoleCardProps {
  teacher: NonNullable<PersonLookupResult['roles']['teacher']>
}

export function TeacherRoleCard({ teacher }: TeacherRoleCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Teacher Role</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-muted-foreground">Programs</Label>
          <div className="mt-2">
            <ProgramBadges programs={teacher.programs} />
          </div>
        </div>
        <div>
          <Label className="text-muted-foreground">Student Count</Label>
          <p className="text-2xl font-bold">{teacher.studentCount}</p>
        </div>
      </CardContent>
    </Card>
  )
}

interface StudentRoleCardProps {
  student: NonNullable<PersonLookupResult['roles']['student']>
}

export function StudentRoleCard({ student }: StudentRoleCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Role</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {student.profiles.map((profile) => (
            <div key={profile.id} className="rounded-md border bg-muted/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <Badge variant="default">
                  {profile.program.replace('_PROGRAM', '')}
                </Badge>
                <Badge
                  variant={
                    profile.status === 'ENROLLED' ? 'default' : 'secondary'
                  }
                >
                  {profile.status}
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                {profile.levelGroup && (
                  <div>
                    <span className="text-muted-foreground">Level: </span>
                    {profile.levelGroup}
                  </div>
                )}
                {profile.shift && (
                  <div>
                    <span className="text-muted-foreground">Shift: </span>
                    {profile.shift}
                  </div>
                )}
                {profile.teacherName && (
                  <div>
                    <span className="text-muted-foreground">Teacher: </span>
                    {profile.teacherName}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface ParentRoleCardProps {
  parent: NonNullable<PersonLookupResult['roles']['parent']>
}

export function ParentRoleCard({ parent }: ParentRoleCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parent Role</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {parent.children.map((child) => (
            <div key={child.id} className="rounded-md border bg-muted/50 p-4">
              <div className="mb-2 font-semibold">{child.name}</div>
              <div className="flex flex-wrap gap-2">
                {child.programs.map((prog, idx) => (
                  <Badge
                    key={idx}
                    variant={prog.status === 'ENROLLED' ? 'default' : 'outline'}
                  >
                    {prog.program.replace('_PROGRAM', '')} - {prog.status}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
