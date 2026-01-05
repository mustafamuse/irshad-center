/**
 * Unified Type System for Student Platform
 *
 * These types represent the new unified identity model:
 * Person → ProgramProfile → Enrollment
 *
 * Replaces legacy Student model with proper entity relationships.
 */

import type {
  Person,
  ProgramProfile,
  Enrollment,
  ContactPoint,
  GuardianRelationship,
  SiblingRelationship,
  BillingAccount,
  Subscription,
  BillingAssignment,
  Batch,
  Teacher,
  StudentPayment,
  Program,
  EnrollmentStatus,
} from '@prisma/client'

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * StudentProfile - Replaces legacy StudentWithDetails
 *
 * Represents a complete student view with all relationships.
 * This is the primary type for displaying student information.
 */
export type StudentProfile = ProgramProfile & {
  person: Person & {
    contactPoints: ContactPoint[]
    guardianRelationships: Array<
      GuardianRelationship & {
        guardian: Person & {
          contactPoints: ContactPoint[]
        }
      }
    >
    siblingRelationships1: Array<
      SiblingRelationship & {
        person2: Person
      }
    >
    siblingRelationships2: Array<
      SiblingRelationship & {
        person1: Person
      }
    >
  }
  enrollments: Array<
    Enrollment & {
      batch: Batch | null
    }
  >
  assignments: Array<
    BillingAssignment & {
      subscription: Subscription & {
        billingAccount: BillingAccount
      }
    }
  >
  payments: StudentPayment[]
}

/**
 * FamilyProfile - For Dugsi family view
 *
 * Represents a family unit with guardian(s) and children.
 */
export type FamilyProfile = {
  familyReferenceId: string
  guardian: Person & {
    contactPoints: ContactPoint[]
  }
  secondaryGuardian?:
    | (Person & {
        contactPoints: ContactPoint[]
      })
    | null
  children: Array<
    ProgramProfile & {
      person: Person & {
        contactPoints: ContactPoint[]
      }
      enrollments: Array<
        Enrollment & {
          batch: Batch | null
        }
      >
    }
  >
  billingAccount: BillingAccount & {
    subscriptions: Array<
      Subscription & {
        assignments: BillingAssignment[]
      }
    >
  }
}

/**
 * TeacherProfile - Complete teacher view with multi-role support
 *
 * Teachers can simultaneously be:
 * - Staff member (Teacher role)
 * - Parent (GuardianRelationship)
 * - Payer (BillingAccount)
 * - Student (ProgramProfile)
 */
export type TeacherProfile = Person & {
  contactPoints: ContactPoint[]
  teacher: Teacher
  dependentRelationships?: Array<
    GuardianRelationship & {
      dependent: Person
    }
  >
  billingAccounts?: BillingAccount[]
  programProfiles?: ProgramProfile[]
}

/**
 * PayerProfile - For billing and payment management
 *
 * Represents the person responsible for payments.
 */
export type PayerProfile = Person & {
  contactPoints: ContactPoint[]
  billingAccounts: Array<
    BillingAccount & {
      subscriptions: Array<
        Subscription & {
          assignments: Array<
            BillingAssignment & {
              programProfile: ProgramProfile & {
                person: Person
              }
            }
          >
        }
      >
    }
  >
  dependentRelationships?: Array<
    GuardianRelationship & {
      dependent: Person & {
        programProfiles: ProgramProfile[]
      }
    }
  >
}

// ============================================================================
// SIMPLIFIED TYPES (for lists and cards)
// ============================================================================

/**
 * StudentListItem - Lightweight type for student lists
 */
export type StudentListItem = {
  id: string
  personId: string
  name: string
  program: Program
  status: EnrollmentStatus
  email: string | null
  phone: string | null
  currentBatch: string | null
  hasActiveSubscription: boolean
  createdAt: Date
}

/**
 * FamilyListItem - Lightweight type for family lists
 */
export type FamilyListItem = {
  familyReferenceId: string
  guardianName: string
  guardianEmail: string | null
  guardianPhone: string | null
  childrenCount: number
  hasActiveSubscription: boolean
  needsAttention: boolean
}

/**
 * TeacherListItem - Lightweight type for teacher lists
 */
export type TeacherListItem = {
  id: string
  personId: string
  name: string
  email: string | null
  phone: string | null
  activeAssignmentsCount: number
  isAlsoParent: boolean
  isAlsoStudent: boolean
}

// ============================================================================
// QUERY RESULT TYPES
// ============================================================================

/**
 * PersonWithRelations - Person with all possible relationships
 */
export type PersonWithRelations = Person & {
  contactPoints: ContactPoint[]
  programProfiles: Array<
    ProgramProfile & {
      enrollments: Enrollment[]
    }
  >
  guardianRelationships: Array<
    GuardianRelationship & {
      dependent: Person
    }
  >
  dependentRelationships: Array<
    GuardianRelationship & {
      guardian: Person
    }
  >
  siblingRelationships1: Array<
    SiblingRelationship & {
      person2: Person
    }
  >
  siblingRelationships2: Array<
    SiblingRelationship & {
      person1: Person
    }
  >
  billingAccounts: BillingAccount[]
  teacher: Teacher | null
}

/**
 * EnrollmentWithRelations - Enrollment with all details
 */
export type EnrollmentWithRelations = Enrollment & {
  programProfile: ProgramProfile & {
    person: Person & {
      contactPoints: ContactPoint[]
    }
  }
  batch: Batch | null
}

/**
 * SubscriptionWithRelations - Subscription with assignments
 */
export type SubscriptionWithRelations = Subscription & {
  billingAccount: BillingAccount & {
    person: Person & {
      contactPoints: ContactPoint[]
    }
  }
  assignments: Array<
    BillingAssignment & {
      programProfile: ProgramProfile & {
        person: Person
      }
    }
  >
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * PersonRole - All possible roles a Person can have
 */
export type PersonRole =
  | 'STUDENT'
  | 'GUARDIAN'
  | 'TEACHER'
  | 'PAYER'
  | 'SIBLING'

/**
 * PersonRoles - Object describing all roles for a Person
 */
export type PersonRoles = {
  isStudent: boolean
  isGuardian: boolean
  isTeacher: boolean
  isPayer: boolean
  hasSiblings: boolean
  programs: Program[]
}

/**
 * ContactInfo - Extracted contact information
 */
export type ContactInfo = {
  primaryEmail: string | null
  primaryPhone: string | null
  allEmails: string[]
  allPhones: string[]
}

/**
 * EnrollmentSummary - Summary of enrollment status
 */
export type EnrollmentSummary = {
  totalEnrollments: number
  activeEnrollments: number
  currentPrograms: Program[]
  currentBatches: string[]
  status: EnrollmentStatus
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if a Person has a Teacher role
 */
export function isTeacher(
  person: PersonWithRelations
): person is PersonWithRelations & { teacher: Teacher } {
  return person.teacher !== null
}

/**
 * Check if a Person has guardian relationships (is a parent)
 */
export function isGuardian(person: PersonWithRelations): boolean {
  return person.dependentRelationships.length > 0
}

/**
 * Check if a Person has program profiles (is a student)
 */
export function isStudent(person: PersonWithRelations): boolean {
  return person.programProfiles.length > 0
}

/**
 * Check if a Person has billing accounts (is a payer)
 */
export function isPayer(person: PersonWithRelations): boolean {
  return person.billingAccounts.length > 0
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Extract type for Prisma include options
 */
export type IncludeStudentProfile = {
  person: {
    include: {
      contactPoints: true
      guardianRelationships: {
        include: {
          guardian: {
            include: {
              contactPoints: true
            }
          }
        }
      }
      siblingRelationships1: {
        include: {
          person2: true
        }
      }
      siblingRelationships2: {
        include: {
          person1: true
        }
      }
    }
  }
  enrollments: {
    include: {
      batch: true
    }
  }
  assignments: {
    include: {
      subscription: {
        include: {
          billingAccount: true
        }
      }
    }
  }
  payments: true
}
