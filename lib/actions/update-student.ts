'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { after } from 'next/server'

import {
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'
import { z } from 'zod'

import { adminActionClient } from '@/lib/safe-action'
import { updateMahadStudent } from '@/lib/services/mahad/student-service'

const updateStudentSchema = z.object({
  studentId: z.string().uuid(),
  name: z.string().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  gradeLevel: z.nativeEnum(GradeLevel).nullable().optional(),
  schoolName: z.string().nullable().optional(),
  graduationStatus: z.nativeEnum(GraduationStatus).nullable().optional(),
  paymentFrequency: z.nativeEnum(PaymentFrequency).nullable().optional(),
  billingType: z.nativeEnum(StudentBillingType).nullable().optional(),
  paymentNotes: z.string().nullable().optional(),
})

export const updateStudent = adminActionClient
  .metadata({ actionName: 'updateStudent' })
  .schema(updateStudentSchema)
  .action(async ({ parsedInput }) => {
    const { studentId, ...data } = parsedInput
    await updateMahadStudent(studentId, data)
    after(() => {
      revalidateTag('mahad-students')
      revalidateTag('mahad-stats')
      revalidatePath('/admin/mahad')
    })
  })
