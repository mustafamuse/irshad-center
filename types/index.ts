import { Student, Batch, StudentPayment } from '@prisma/client'

export type SearchParams = {
  [key: string]: string | string[] | undefined
}

export type StudentWithDetails = Student & {
  Batch: Batch | null
  StudentPayment: StudentPayment[]
  subscriptionMembers?: Array<{
    id: string
    name: string
  }>
}
