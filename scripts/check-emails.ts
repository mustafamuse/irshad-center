import { prisma } from '@/lib/db'

async function checkStudentEmails() {
  // Get students without emails
  const studentsWithoutEmail = await prisma.student.findMany({
    where: {
      OR: [
        { email: null },
        { email: '' }
      ]
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      program: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  console.log('\n=== Students WITHOUT Email (sorted by creation date) ===')
  console.log(`Total count: ${studentsWithoutEmail.length}`)

  // Count by program
  const programCounts = studentsWithoutEmail.reduce((acc, s) => {
    const program = s.program || 'unknown'
    acc[program] = (acc[program] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('\nBreakdown by Program:')
  Object.entries(programCounts).forEach(([program, count]) => {
    console.log(`- ${program.toUpperCase()}: ${count} students`)
  })

  console.log('\nDetailed List:')
  studentsWithoutEmail.forEach(s => {
    const date = new Date(s.createdAt).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Chicago'
    })
    console.log(`- ${s.name} (${s.program?.toUpperCase() || 'NO PROGRAM'}): Created ${date}`)
  })

  // Get students WITH emails for comparison
  const studentsWithEmail = await prisma.student.findMany({
    where: {
      AND: [
        { email: { not: null } },
        { email: { not: '' } }
      ]
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      program: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  console.log('\n=== Students WITH Email - Creation Date Analysis ===')
  console.log(`Total count: ${studentsWithEmail.length}`)

  // Count by program for students WITH email
  const withEmailProgramCounts = studentsWithEmail.reduce((acc, s) => {
    const program = s.program || 'unknown'
    acc[program] = (acc[program] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('\nBreakdown by Program (WITH email):')
  Object.entries(withEmailProgramCounts).forEach(([program, count]) => {
    console.log(`- ${program.toUpperCase()}: ${count} students`)
  })

  if (studentsWithEmail.length > 0) {
    const sortedByDate = [...studentsWithEmail].sort((a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime()
    )

    console.log(`Earliest: ${sortedByDate[0].name} - ${sortedByDate[0].createdAt.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Chicago'
    })}`)
    console.log(`Latest: ${sortedByDate[sortedByDate.length - 1].name} - ${sortedByDate[sortedByDate.length - 1].createdAt.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Chicago'
    })}`)

    console.log('\nRecent students WITH email (last 5):')
    studentsWithEmail.slice(0, 5).forEach(s => {
      const date = new Date(s.createdAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
      console.log(`- ${s.name}: ${s.email} (Created ${date})`)
    })
  }

  // Check specific students mentioned
  const specificNames = ['Ayan Abdirizak', 'Sayed Dirie', 'Maida Mohamed', 'Hafsa Mohamed']
  const specificStudents = await prisma.student.findMany({
    where: {
      name: {
        in: specificNames
      }
    },
    select: {
      name: true,
      email: true,
      phone: true,
      batchId: true,
      Batch: {
        select: {
          name: true
        }
      }
    }
  })

  console.log('\n=== Specific Students Check ===')
  specificStudents.forEach(s => {
    console.log(`${s.name}:`)
    console.log(`  - Email: "${s.email}"`)
    console.log(`  - Phone: "${s.phone}"`)
    console.log(`  - Batch: ${s.Batch?.name || 'Unassigned (batchId: ' + s.batchId + ')'}`)
  })

  // Overall stats
  const totalStudents = await prisma.student.count()
  const withEmailCount = await prisma.student.count({
    where: {
      AND: [
        { email: { not: null } },
        { email: { not: '' } }
      ]
    }
  })

  console.log('\n=== Overall Email Statistics ===')
  console.log(`Total students: ${totalStudents}`)
  console.log(`With email: ${withEmailCount}`)
  console.log(`Without email: ${totalStudents - withEmailCount}`)
  console.log(`Percentage with email: ${((withEmailCount/totalStudents) * 100).toFixed(1)}%`)

  // Date range analysis
  if (studentsWithoutEmail.length > 0) {
    const sortedByDate = [...studentsWithoutEmail].sort((a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime()
    )

    console.log('\n=== Creation Date Range for Students WITHOUT Email ===')
    console.log(`Earliest: ${sortedByDate[0].name} - ${sortedByDate[0].createdAt.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Chicago'
    })}`)
    console.log(`Latest: ${sortedByDate[sortedByDate.length - 1].name} - ${sortedByDate[sortedByDate.length - 1].createdAt.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Chicago'
    })}`)
  }

  await prisma.$disconnect()
}

checkStudentEmails().catch(console.error)