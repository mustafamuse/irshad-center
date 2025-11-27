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

/**
 * Format graduation status for display
 */
export function formatGraduationStatus(status: string | null): string {
  if (!status) return '—'
  const map: Record<string, string> = {
    NON_GRADUATE: 'Non-Graduate (Still in School)',
    GRADUATE: 'Graduate',
  }
  return map[status] || status
}

/**
 * Format payment frequency for display
 */
export function formatPaymentFrequency(frequency: string | null): string {
  if (!frequency) return '—'
  const map: Record<string, string> = {
    MONTHLY: 'Monthly',
    BI_MONTHLY: 'Bi-Monthly (Every 2 Months)',
  }
  return map[frequency] || frequency
}

/**
 * Format student billing type for display
 */
export function formatBillingType(type: string | null): string {
  if (!type) return '—'
  const map: Record<string, string> = {
    FULL_TIME: 'Full-Time',
    FULL_TIME_SCHOLARSHIP: 'Full-Time (Scholarship)',
    PART_TIME: 'Part-Time',
    EXEMPT: 'Exempt',
  }
  return map[type] || type
}
