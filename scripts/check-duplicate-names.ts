import { prisma } from '../lib/db'

// Function to calculate Levenshtein distance between two strings
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

// Function to calculate similarity percentage
function calculateSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase())
  const maxLength = Math.max(a.length, b.length)
  return Math.round(((maxLength - distance) / maxLength) * 100)
}

async function checkDuplicateNames() {
  console.log('Checking for duplicate or similar names in Student table...')

  // Get all students
  const students = await prisma.student.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
      batchId: true,
      Batch: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  })

  console.log(`Found ${students.length} students`)

  // Find exact duplicates
  const nameGroups: Record<string, typeof students> = {}

  for (const student of students) {
    const name = student.name.toLowerCase()
    if (!nameGroups[name]) {
      nameGroups[name] = []
    }
    nameGroups[name].push(student)
  }

  const exactDuplicates = Object.entries(nameGroups)
    .filter(([_, group]) => group.length > 1)
    .map(([name, group]) => ({
      name,
      count: group.length,
      students: group.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    }))

  // Find similar names (using Levenshtein distance)
  const similarityThreshold = 80 // Minimum similarity percentage to consider as similar
  const similarGroups: Array<{
    students: typeof students
    similarity: number
  }> = []

  // Compare each student with every other student
  for (let i = 0; i < students.length; i++) {
    for (let j = i + 1; j < students.length; j++) {
      // Skip exact matches as they're handled separately
      if (students[i].name.toLowerCase() === students[j].name.toLowerCase())
        continue

      const similarity = calculateSimilarity(students[i].name, students[j].name)

      if (similarity >= similarityThreshold) {
        // Check if either student is already in a group
        const existingGroupIndex = similarGroups.findIndex((group) =>
          group.students.some(
            (s) => s.id === students[i].id || s.id === students[j].id
          )
        )

        if (existingGroupIndex >= 0) {
          // Add to existing group if not already present
          const group = similarGroups[existingGroupIndex]
          if (!group.students.some((s) => s.id === students[i].id)) {
            group.students.push(students[i])
          }
          if (!group.students.some((s) => s.id === students[j].id)) {
            group.students.push(students[j])
          }
          // Update similarity to the lowest found
          group.similarity = Math.min(group.similarity, similarity)
        } else {
          // Create new group
          similarGroups.push({
            students: [students[i], students[j]],
            similarity,
          })
        }
      }
    }
  }

  // Print exact duplicates
  if (exactDuplicates.length === 0) {
    console.log('\nNo exact duplicate names found.')
  } else {
    console.log(
      `\nFound ${exactDuplicates.length} exact duplicate name groups:`
    )

    exactDuplicates.forEach(({ name, count, students }) => {
      console.log(`\nName: "${name}" (${count} records)`)
      students.forEach((student, index) => {
        console.log(`  ${index + 1}. ID: ${student.id}`)
        console.log(`     Email: ${student.email || 'None'}`)
        console.log(`     Phone: ${student.phone || 'None'}`)
        console.log(`     Batch: ${student.Batch?.name || 'None'}`)
        console.log(`     Created: ${student.createdAt.toISOString()}`)
        console.log(`     Updated: ${student.updatedAt.toISOString()}`)
      })
    })
  }

  // Print similar names
  if (similarGroups.length === 0) {
    console.log('\nNo similar names found.')
  } else {
    console.log(`\nFound ${similarGroups.length} similar name groups:`)

    // Sort by similarity (highest first)
    similarGroups.sort((a, b) => b.similarity - a.similarity)

    similarGroups.forEach(({ similarity, students }, groupIndex) => {
      console.log(`\nGroup ${groupIndex + 1} - Similarity: ${similarity}%`)
      students.forEach((student, index) => {
        console.log(`  ${index + 1}. Name: "${student.name}"`)
        console.log(`     ID: ${student.id}`)
        console.log(`     Email: ${student.email || 'None'}`)
        console.log(`     Phone: ${student.phone || 'None'}`)
        console.log(`     Batch: ${student.Batch?.name || 'None'}`)
      })
    })
  }
}

checkDuplicateNames()
  .then(() => {
    console.log('\nCheck completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error checking for duplicate names:', error)
    process.exit(1)
  })
