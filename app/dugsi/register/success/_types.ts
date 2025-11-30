import { Gender } from '@prisma/client'

export interface Family {
  familyKey: string
  parent1Name: string | null
  parent1Email: string | null
  parent1Phone: string | null
  parent2Name: string | null
  parent2Email: string | null
  parent2Phone: string | null
  children: Array<{
    id: string
    name: string
    gradeLevel: string | null
    schoolName: string | null
    dateOfBirth: Date | null
    gender: Gender | null
    createdAt: Date
  }>
  registeredAt: Date
}
