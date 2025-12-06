'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

import type { MultiRolePerson } from '../../actions'

interface Props {
  people: MultiRolePerson[]
}

export function MultiRolePeopleList({ people }: Props) {
  if (people.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No people found with multiple roles
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {people.map((person) => (
        <Card key={person.id} className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">{person.name}</h3>
                <Badge variant="secondary" className="text-xs">
                  {person.roleCount} roles
                </Badge>
              </div>

              <div className="space-y-1 text-sm text-muted-foreground">
                {person.email && <div>{person.email}</div>}
                {person.phone && <div>{person.phone}</div>}
              </div>

              <div className="flex flex-wrap gap-2">
                {person.roles.teacher && (
                  <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1">
                    <span className="text-sm font-medium text-blue-900">
                      Teacher:
                    </span>
                    <div className="flex gap-1">
                      {person.roles.teacher.programs.map((program) => (
                        <Badge
                          key={program}
                          variant="outline"
                          className="border-blue-200 text-xs text-blue-700"
                        >
                          {program.replace('_PROGRAM', '')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {person.roles.student && (
                  <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-1">
                    <span className="text-sm font-medium text-green-900">
                      Student:
                    </span>
                    <div className="flex gap-1">
                      {person.roles.student.programs.map((program) => (
                        <Badge
                          key={program}
                          variant="outline"
                          className="border-green-200 text-xs text-green-700"
                        >
                          {program.replace('_PROGRAM', '')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {person.roles.parent && (
                  <div className="flex items-center gap-2 rounded-md bg-purple-50 px-3 py-1">
                    <span className="text-sm font-medium text-purple-900">
                      Parent:
                    </span>
                    <span className="text-xs text-purple-700">
                      {person.roles.parent.childCount}{' '}
                      {person.roles.parent.childCount === 1
                        ? 'child'
                        : 'children'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
