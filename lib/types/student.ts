export enum StudentStatus {
  REGISTERED = 'registered', // Initial state, not yet in classes
  ENROLLED = 'enrolled', // Actively attending classes
  ON_LEAVE = 'on_leave', // Temporary approved break
  WITHDRAWN = 'withdrawn', // No longer attending
}

// Helper function to check if a status is valid
export function isValidStudentStatus(status: string): status is StudentStatus {
  return Object.values(StudentStatus).includes(status as StudentStatus)
}

// Helper function to get the display name of a status
export function getStudentStatusDisplay(status: StudentStatus): string {
  switch (status) {
    case StudentStatus.REGISTERED:
      return 'Registered'
    case StudentStatus.ENROLLED:
      return 'Enrolled'
    case StudentStatus.ON_LEAVE:
      return 'On Leave'
    case StudentStatus.WITHDRAWN:
      return 'Withdrawn'
    default:
      return 'Unknown'
  }
}

export interface StudentDetails {
  student: {
    id: string
    name: string
    email?: string
    phone?: string
    status: string
    gradeLevel?: string
    schoolName?: string
    // Mahad billing fields
    graduationStatus?: string
    paymentFrequency?: string
    billingType?: string
    paymentNotes?: string
  }
  associations: {
    batch?: {
      id: string
      name: string
    }
    subscription?: {
      id: string
      status: string
      isActive: boolean
    }
    siblingGroup?: {
      id: string
      students: Array<{
        id: string
        name: string
      }>
    }
  }
}

export interface DeleteWarnings {
  hasSiblings: boolean
  isOnlyStudentForPayer: boolean
  hasActiveSubscription: boolean
}
