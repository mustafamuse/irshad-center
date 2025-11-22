import type { Person, ProgramProfile, Enrollment } from '@prisma/client'

export type DetectionMethod =
  | 'MANUAL'
  | 'GUARDIAN_MATCH'
  | 'NAME_MATCH'
  | 'CONTACT_MATCH'

export interface SiblingRelationship {
  id: string
  person1Id: string
  person2Id: string
  detectionMethod: DetectionMethod
  confidence: number | null
  verifiedBy: string | null
  verifiedAt: Date | null
  isActive: boolean
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface SiblingDetails {
  person: Person
  profiles: Array<
    ProgramProfile & {
      enrollments: Enrollment[]
    }
  >
  isActive: boolean
  relationshipId: string
  detectionMethod: string
  confidence: number | null
}

export interface SiblingGroup {
  siblings: Array<{
    person: {
      id: string
      name: string
      dateOfBirth: string | null
    }
    profiles: Array<{
      id: string
      program: string
      status: string
      enrollments: Array<{
        id: string
        status: string
        startDate: string
      }>
    }>
  }>
  totalSiblings: number
  programs: string[]
}

export interface PotentialSibling {
  person: Person
  method: DetectionMethod
  confidence: number
  reasons: string[]
}
