import { NextResponse } from 'next/server'

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
function _calculateSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase())
  const maxLength = Math.max(a.length, b.length)
  return Math.round(((maxLength - distance) / maxLength) * 100)
}

export async function GET(_request: Request) {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return NextResponse.json({
    exact: {
      groups: [],
      totalGroups: 0,
      totalStudents: 0,
    },
    similar: {
      groups: [],
      totalGroups: 0,
      totalStudents: 0,
    },
  })
}

export const dynamic = 'force-dynamic'
