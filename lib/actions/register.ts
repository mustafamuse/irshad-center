'use server'

import { revalidatePath } from 'next/cache'

import {
  studentFormSchema,
  type StudentFormValues,
} from '@/app/mahad/register/schema'
import { prisma } from '@/lib/db'

// Helper function for consistent capitalization
function capitalizeNames(firstName: string, lastName: string) {
  return {
    firstName: firstName.trim().replace(/\b\w/g, (c) => c.toUpperCase()),
    lastName: lastName.trim().replace(/\b\w/g, (c) => c.toUpperCase()),
  }
}

// Get students for registration
export async function getRegistrationStudents() {
  try {
    const students = await prisma.student.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        educationLevel: true,
        gradeLevel: true,
        schoolName: true,
        updatedAt: true,
        siblingGroup: {
          select: {
            students: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return students
  } catch (error) {
    console.error('Failed to fetch students:', error)
    throw new Error('Failed to fetch students')
  }
}

export type RegisteredStudents = Awaited<
  ReturnType<typeof getRegistrationStudents>
>[0]

export async function addSibling(studentId: string, siblingId: string) {
  if (studentId === siblingId) {
    throw new Error('Cannot add student as their own sibling')
  }

  return await prisma.$transaction(async (tx) => {
    // Get both students with their current sibling groups
    const [student, sibling] = await Promise.all([
      tx.student.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          name: true,
          siblingGroupId: true,
          siblingGroup: {
            select: {
              students: {
                select: { id: true },
              },
            },
          },
        },
      }),
      tx.student.findUnique({
        where: { id: siblingId },
        select: {
          id: true,
          name: true,
          siblingGroupId: true,
          siblingGroup: {
            select: {
              students: {
                select: { id: true },
              },
            },
          },
        },
      }),
    ])

    if (!student || !sibling) {
      throw new Error('One or both students not found')
    }

    // Case 1: Neither student has a group
    if (!student.siblingGroupId && !sibling.siblingGroupId) {
      // Create new group with both students
      const newGroup = await tx.sibling.create({
        data: {
          students: {
            connect: [{ id: studentId }, { id: siblingId }],
          },
        },
        include: {
          students: {
            select: { id: true, name: true },
          },
        },
      })

      if (newGroup.students.length !== 2) {
        throw new Error('Failed to create sibling group with both students')
      }

      return newGroup
    }

    // Case 2: Student has group, sibling doesn't
    if (student.siblingGroupId && !sibling.siblingGroupId) {
      // Verify current group size
      const currentGroupSize = student.siblingGroup?.students.length ?? 0
      if (currentGroupSize < 1) {
        throw new Error('Invalid existing sibling group state')
      }

      // Add sibling to existing group
      await tx.student.update({
        where: { id: siblingId },
        data: { siblingGroupId: student.siblingGroupId },
      })
    }

    // Case 3: Sibling has group, student doesn't
    else if (!student.siblingGroupId && sibling.siblingGroupId) {
      // Verify current group size
      const currentGroupSize = sibling.siblingGroup?.students.length ?? 0
      if (currentGroupSize < 1) {
        throw new Error('Invalid existing sibling group state')
      }

      // Add student to existing group
      await tx.student.update({
        where: { id: studentId },
        data: { siblingGroupId: sibling.siblingGroupId },
      })
    }

    // Case 4: Both have different groups
    else if (student.siblingGroupId !== sibling.siblingGroupId) {
      // Verify both group sizes
      const [studentGroupSize, siblingGroupSize] = [
        student.siblingGroup?.students.length ?? 0,
        sibling.siblingGroup?.students.length ?? 0,
      ]

      if (studentGroupSize < 1 || siblingGroupSize < 1) {
        throw new Error('Invalid sibling group state')
      }

      // Merge groups by moving all siblings to student's group
      await Promise.all([
        tx.student.updateMany({
          where: { siblingGroupId: sibling.siblingGroupId },
          data: { siblingGroupId: student.siblingGroupId },
        }),
        tx.sibling.delete({
          where: { id: sibling.siblingGroupId! },
        }),
      ])
    }

    // Get updated student data
    const updatedStudent = await tx.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        educationLevel: true,
        gradeLevel: true,
        schoolName: true,
        siblingGroup: {
          select: {
            students: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    if (!updatedStudent?.siblingGroup) {
      throw new Error('Failed to update sibling relationship')
    }

    // Verify final group state
    if (updatedStudent.siblingGroup.students.length < 2) {
      throw new Error('Invalid final sibling group state')
    }

    // Revalidate the entire registration route
    revalidatePath('/mahad/register', 'layout')

    return { success: true, student: updatedStudent }
  })
}

export async function removeSibling(studentId: string, siblingId: string) {
  if (studentId === siblingId) {
    throw new Error('Cannot remove student from their own sibling group')
  }

  return await prisma.$transaction(async (tx) => {
    // Get student with their current sibling group
    const student = await tx.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        siblingGroupId: true,
        siblingGroup: {
          select: {
            students: {
              select: { id: true },
            },
          },
        },
      },
    })

    if (!student?.siblingGroupId) {
      throw new Error('Student or sibling group not found')
    }

    // Get current group size
    const currentGroupSize = student.siblingGroup?.students.length ?? 0

    if (currentGroupSize <= 2) {
      // If we're about to remove from a group of 2 or fewer,
      // delete the whole group and clear all references
      await Promise.all([
        tx.student.updateMany({
          where: { siblingGroupId: student.siblingGroupId },
          data: { siblingGroupId: null },
        }),
        tx.sibling.delete({
          where: { id: student.siblingGroupId },
        }),
      ])
    } else {
      // Safe to remove just the one student
      await tx.student.update({
        where: { id: siblingId },
        data: { siblingGroupId: null },
      })

      // Verify the group still has at least 2 members
      const remainingMembers = await tx.student.count({
        where: { siblingGroupId: student.siblingGroupId },
      })

      if (remainingMembers < 2) {
        // Something went wrong, clean up the group
        await Promise.all([
          tx.student.updateMany({
            where: { siblingGroupId: student.siblingGroupId },
            data: { siblingGroupId: null },
          }),
          tx.sibling.delete({
            where: { id: student.siblingGroupId },
          }),
        ])
      }
    }

    // Get updated student data
    const updatedStudent = await tx.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        educationLevel: true,
        gradeLevel: true,
        schoolName: true,
        siblingGroup: {
          select: {
            students: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    // Revalidate the entire registration route
    revalidatePath('/mahad/register', 'layout')

    return { success: true, student: updatedStudent }
  })
}

export async function getRegistrationStudent(id: string) {
  try {
    const student = await prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        educationLevel: true,
        gradeLevel: true,
        schoolName: true,
        updatedAt: true,
        siblingGroup: {
          select: {
            students: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    if (!student) return null

    return student
  } catch (error) {
    console.error('Failed to fetch student:', error)
    throw new Error('Failed to fetch student')
  }
}

interface RegisterWithSiblingsInput {
  studentData: StudentFormValues
  siblingIds: string[] | null
}

export async function registerWithSiblings(input: RegisterWithSiblingsInput) {
  return await prisma.$transaction(async (tx) => {
    try {
      // 1. Validate and capitalize names
      const validated = studentFormSchema.parse(input.studentData)
      const { firstName, lastName } = capitalizeNames(
        validated.firstName,
        validated.lastName
      )
      const fullName = `${firstName} ${lastName}`.trim()

      // Log the data we're about to submit
      console.log('Registering student with data:', {
        studentData: {
          ...validated,
          firstName,
          lastName,
          fullName,
        },
        siblingIds: input.siblingIds,
      })

      // 2. Check for existing student with same phone number
      if (validated.phone) {
        // Normalize the phone number for comparison
        const normalizedPhone = validated.phone.replace(/\D/g, '')

        if (normalizedPhone.length >= 7) {
          // Find all students and check their normalized phone numbers
          const allStudents = await tx.student.findMany({
            where: {
              phone: {
                not: null,
              },
            },
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          })

          const existingStudent = allStudents.find((student) => {
            if (!student.phone) return false
            const existingNormalized = student.phone.replace(/\D/g, '')
            return existingNormalized === normalizedPhone
          })

          if (existingStudent) {
            throw new Error(
              `A student with phone number ${validated.phone} already exists: ${existingStudent.name}`
            )
          }
        }
      }

      // 3. Check for existing student with same email (if provided)
      if (validated.email) {
        const existingByEmail = await tx.student.findFirst({
          where: {
            email: {
              equals: validated.email,
              mode: 'insensitive',
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })

        if (existingByEmail) {
          throw new Error(
            `A student with email ${validated.email} already exists: ${existingByEmail.name}`
          )
        }
      }

      // 4. Create the student
      const newStudent = await tx.student.create({
        data: {
          name: fullName,
          email: validated.email,
          phone: validated.phone,
          dateOfBirth: validated.dateOfBirth,
          educationLevel: validated.educationLevel,
          gradeLevel: validated.gradeLevel,
          schoolName: validated.schoolName,
        },
      })

      // 5. If there are siblings, create/update sibling group
      if (input.siblingIds?.length) {
        // Create sibling group and connect students
        await tx.sibling.create({
          data: {
            students: {
              connect: [
                { id: newStudent.id },
                ...input.siblingIds.map((id) => ({ id })),
              ],
            },
          },
        })

        // Get the final state with all details
        const finalStudent = await tx.student.findUnique({
          where: { id: newStudent.id },
          include: {
            siblingGroup: {
              include: {
                students: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        })

        if (!finalStudent) {
          throw new Error('Failed to create student record')
        }

        return {
          success: true,
          student: finalStudent,
          siblingGroup: finalStudent.siblingGroup,
        }
      }

      // If no siblings, return just the student
      return {
        success: true,
        student: newStudent,
      }
    } catch (error) {
      console.error('Registration failed:', error)
      throw error instanceof Error
        ? error
        : new Error('Failed to complete registration')
    }
  })
}
