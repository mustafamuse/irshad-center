'use client'

import { Badge } from '@/components/ui/badge'
import {
  PROGRAM_LABELS,
  PROGRAM_BADGE_COLORS,
} from '@/lib/constants/program-ui'

import { TeacherWithDetails } from '../actions'

interface Props {
  teacher: TeacherWithDetails
}

export function TeacherDetailsTab({ teacher }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border p-4">
        <div>
          <h4 className="text-sm font-medium text-muted-foreground">
            Full Name
          </h4>
          <p className="text-base">{teacher.name}</p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-muted-foreground">Email</h4>
          <p className="text-base">{teacher.email || '—'}</p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-muted-foreground">Phone</h4>
          <p className="text-base">{teacher.phone || '—'}</p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-muted-foreground">
            Programs
          </h4>
          <div className="mt-1 flex flex-wrap gap-1">
            {teacher.programs.length > 0 ? (
              teacher.programs.map((program) => (
                <Badge
                  key={program}
                  variant={PROGRAM_BADGE_COLORS[program]}
                  className="text-xs"
                >
                  {PROGRAM_LABELS[program]}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">
                No programs assigned
              </span>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-muted-foreground">
            Active Students
          </h4>
          <p className="text-base">{teacher.studentCount}</p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-muted-foreground">
            Created At
          </h4>
          <p className="text-base">
            {new Date(teacher.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  )
}
