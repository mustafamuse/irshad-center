'use server'

import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/db'

export async function getDugsiRegistrations() {
  const students = await prisma.student.findMany({
    where: { program: 'DUGSI_PROGRAM' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      gender: true,
      dateOfBirth: true,
      educationLevel: true,
      gradeLevel: true,
      schoolName: true,
      healthInfo: true,
      createdAt: true,
      parentFirstName: true,
      parentLastName: true,
      parentEmail: true,
      parentPhone: true,
      parent2FirstName: true,
      parent2LastName: true,
      parent2Email: true,
      parent2Phone: true,
    },
  })

  return students
}

export async function getFamilyMembers(studentId: string) {
  // Get the selected student
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      parentPhone: true,
      parent2Phone: true,
    },
  })

  if (!student) return []

  // Find all siblings (students with the same parent phone number)
  const phoneNumbers = [student.parentPhone, student.parent2Phone].filter(
    Boolean
  )

  if (phoneNumbers.length === 0) return []

  const siblings = await prisma.student.findMany({
    where: {
      program: 'DUGSI_PROGRAM',
      OR: phoneNumbers.map((phone) => ({
        OR: [{ parentPhone: phone }, { parent2Phone: phone }],
      })),
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      gender: true,
      dateOfBirth: true,
      educationLevel: true,
      gradeLevel: true,
      schoolName: true,
      healthInfo: true,
      createdAt: true,
      parentFirstName: true,
      parentLastName: true,
      parentEmail: true,
      parentPhone: true,
      parent2FirstName: true,
      parent2LastName: true,
      parent2Email: true,
      parent2Phone: true,
    },
  })

  return siblings
}

export async function deleteDugsiFamily(studentId: string) {
  try {
    // Get the student to find family members
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        parentPhone: true,
        parent2Phone: true,
      },
    })

    if (!student) {
      return { success: false, error: 'Student not found' }
    }

    // Find all phone numbers to identify the family
    const phoneNumbers = [student.parentPhone, student.parent2Phone].filter(
      Boolean
    )

    if (phoneNumbers.length === 0) {
      // If no phone numbers, just delete the single student
      await prisma.student.delete({
        where: { id: studentId },
      })
    } else {
      // Delete all family members (students with matching phone numbers)
      await prisma.student.deleteMany({
        where: {
          program: 'DUGSI_PROGRAM',
          OR: phoneNumbers.map((phone) => ({
            OR: [{ parentPhone: phone }, { parent2Phone: phone }],
          })),
        },
      })
    }

    // Revalidate the page to show updated data
    revalidatePath('/admin/dugsi')

    return { success: true }
  } catch (error) {
    console.error('Error deleting family:', error)
    return { success: false, error: 'Failed to delete family' }
  }
}
