// import { PrismaClient } from '@prisma/client'
// import fs from 'fs'
// import path from 'path'
// import { prompts } from 'prompts'

// const prisma = new PrismaClient()

// interface SeedData {
//   batches: Array<{
//     name: string
//     startDate: string | null
//     endDate: string | null
//   }>
//   students: Array<{
//     name: string
//     email: string | null
//     phone: string | null
//     dateOfBirth: string | null
//     educationLevel: string | null
//     gradeLevel: string | null
//     schoolName: string | null
//     highSchoolGraduated: boolean
//     collegeGraduated: boolean
//     postGradCompleted: boolean
//     monthlyRate: number
//     customRate: boolean
//     status: string
//     batchName: string | null
//   }>
//   siblingGroups: Array<{
//     studentNames: string[]
//   }>
// }

// async function main() {
//   try {
//     // Read the seed data file
//     const seedDataPath = path.join(process.cwd(), 'seed-data.json')
//     const seedData: SeedData = JSON.parse(
//       fs.readFileSync(seedDataPath, 'utf-8')
//     )

//     // Ask user for confirmation
//     const response = await prompts({
//       type: 'confirm',
//       name: 'value',
//       message:
//         'This will add new data to your database. Are you sure you want to continue?',
//       initial: false,
//     })

//     if (!response.value) {
//       console.log('Operation cancelled')
//       process.exit(0)
//     }

//     console.log('Creating or updating batches...')
//     for (const batchData of seedData.batches) {
//       await prisma.batch.upsert({
//         where: { name: batchData.name },
//         update: {
//           startDate: batchData.startDate ? new Date(batchData.startDate) : null,
//           endDate: batchData.endDate ? new Date(batchData.endDate) : null,
//         },
//         create: {
//           name: batchData.name,
//           startDate: batchData.startDate ? new Date(batchData.startDate) : null,
//           endDate: batchData.endDate ? new Date(batchData.endDate) : null,
//         },
//       })
//     }

//     console.log('Creating students...')
//     const createdStudents = new Map<string, string>() // Map student names to their IDs

//     for (const studentData of seedData.Student) {
//       // Check if student with same name exists
//       const existingStudent = await prisma.student.findFirst({
//         where: { name: studentData.name },
//       })

//       if (existingStudent) {
//         console.log(`Student ${studentData.name} already exists, skipping...`)
//         createdStudents.set(studentData.name, existingStudent.id)
//         continue
//       }

//       // Find batch if specified
//       let batchId: string | null = null
//       if (studentData.batchName) {
//         const batch = await prisma.batch.findUnique({
//           where: { name: studentData.batchName },
//         })
//         batchId = batch?.id || null
//       }

//       // Create new student
//       const student = await prisma.student.create({
//         data: {
//           name: studentData.name,
//           email: studentData.email,
//           phone: studentData.phone,
//           dateOfBirth: studentData.dateOfBirth
//             ? new Date(studentData.dateOfBirth)
//             : null,
//           educationLevel: studentData.educationLevel,
//           gradeLevel: studentData.gradeLevel,
//           schoolName: studentData.schoolName,
//           highSchoolGraduated: studentData.highSchoolGraduated,
//           collegeGraduated: studentData.collegeGraduated,
//           postGradCompleted: studentData.postGradCompleted,
//           monthlyRate: studentData.monthlyRate,
//           customRate: studentData.customRate,
//           status: studentData.status,
//           batchId,
//         },
//       })
//       createdStudents.set(studentData.name, student.id)
//     }

//     console.log('Creating sibling groups...')
//     for (const groupData of seedData.siblingGroups) {
//       // Only create sibling group if we have at least 2 students
//       const studentIds = groupData.studentNames
//         .map((name) => createdStudents.get(name))
//         .filter((id): id is string => id !== undefined)

//       if (studentIds.length >= 2) {
//         // Check if these students are already in a sibling group
//         const existingSiblingGroup = await prisma.student.findFirst({
//           where: {
//             id: { in: studentIds },
//             siblingGroupId: { not: null },
//           },
//           select: { siblingGroupId: true },
//         })

//         if (existingSiblingGroup?.siblingGroupId) {
//           console.log(
//             `Some students are already in a sibling group, skipping...`
//           )
//           continue
//         }

//         // Create new sibling group
//         const siblingGroup = await prisma.sibling.create({
//           data: {
//             Student: {
//               connect: studentIds.map((id) => ({ id })),
//             },
//           },
//         })
//         console.log(`Created sibling group with ${studentIds.length} students`)
//       }
//     }

//     console.log('Seed completed successfully!')
//   } catch (error) {
//     console.error('Error seeding database:', error)
//     process.exit(1)
//   } finally {
//     await prisma.$disconnect()
//   }
// }

// main()
