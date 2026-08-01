import { Shift } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'

export interface RosterRow {
  teacherName: string
  payerName: string
  payerPhone: string | null
  payerEmail: string | null
  children: string[]
  shift: Shift
}

export async function getDugsiRosterByTeacher(
  client: DatabaseClient = prisma
): Promise<RosterRow[]> {
  const teachers = await client.teacher.findMany({
    include: {
      person: { select: { name: true } },
      dugsiClasses: {
        where: { isActive: true },
        include: {
          class: {
            include: {
              students: {
                where: { isActive: true },
                include: {
                  programProfile: {
                    include: {
                      person: { select: { name: true } },
                      assignments: {
                        where: {
                          isActive: true,
                          subscription: { status: 'active' },
                        },
                        take: 1,
                        include: {
                          subscription: {
                            include: {
                              billingAccount: {
                                include: {
                                  person: {
                                    select: {
                                      id: true,
                                      name: true,
                                      phone: true,
                                      email: true,
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { person: { name: 'asc' } },
  })

  const rows: RosterRow[] = []

  for (const teacher of teachers) {
    const teacherName = teacher.person.name
    const payerMap = new Map<
      string,
      {
        payerName: string
        payerPhone: string | null
        payerEmail: string | null
        children: string[]
        shift: Shift
      }
    >()

    for (const classTeacher of teacher.dugsiClasses) {
      const shift = classTeacher.class.shift

      for (const enrollment of classTeacher.class.students) {
        const profile = enrollment.programProfile

        if (profile.status === 'WITHDRAWN') continue

        const studentName = profile.person.name
        const assignment = profile.assignments[0]
        const payer = assignment?.subscription.billingAccount.person

        const payerKey = payer
          ? `${payer.id}_${shift}`
          : `unknown_${studentName}_${shift}`
        const existing = payerMap.get(payerKey)

        if (existing) {
          if (!existing.children.includes(studentName)) {
            existing.children.push(studentName)
          }
        } else {
          payerMap.set(payerKey, {
            payerName: payer?.name ?? 'Unknown',
            payerPhone: payer?.phone ?? null,
            payerEmail: payer?.email ?? null,
            children: [studentName],
            shift,
          })
        }
      }
    }

    for (const entry of payerMap.values()) {
      rows.push({ teacherName, ...entry })
    }
  }

  return rows
}
