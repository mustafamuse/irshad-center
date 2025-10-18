export function formatEducationLevel(level: string | null): string {
  if (!level) return '—'
  const map: Record<string, string> = {
    HIGH_SCHOOL: 'High School',
    MIDDLE_SCHOOL: 'Middle School',
    ELEMENTARY: 'Elementary',
    COLLEGE: 'College',
    POST_GRAD: 'Post Graduate',
  }
  return map[level] || level
}

export function formatGradeLevel(grade: string | null): string {
  if (!grade) return '—'
  const map: Record<string, string> = {
    KINDERGARTEN: 'Kindergarten',
    GRADE_1: '1st Grade',
    GRADE_2: '2nd Grade',
    GRADE_3: '3rd Grade',
    GRADE_4: '4th Grade',
    GRADE_5: '5th Grade',
    GRADE_6: '6th Grade',
    GRADE_7: '7th Grade',
    GRADE_8: '8th Grade',
    GRADE_9: '9th Grade',
    GRADE_10: '10th Grade',
    GRADE_11: '11th Grade',
    GRADE_12: '12th Grade',
    FRESHMAN: 'Freshman',
    SOPHOMORE: 'Sophomore',
    JUNIOR: 'Junior',
    SENIOR: 'Senior',
  }
  return map[grade] || grade
}
