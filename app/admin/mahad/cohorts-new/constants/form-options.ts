import type { SelectOption } from '../components/students/fields/StudentSelectField'

export const GRADE_LEVEL_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'None' },
  { value: 'KINDERGARTEN', label: 'Kindergarten' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: `GRADE_${i + 1}`,
    label: `Grade ${i + 1}`,
  })),
  { value: 'FRESHMAN', label: 'Freshman' },
  { value: 'SOPHOMORE', label: 'Sophomore' },
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'SENIOR', label: 'Senior' },
]

export const GRADUATION_STATUS_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'None' },
  { value: 'NON_GRADUATE', label: 'Non-Graduate (Still in School)' },
  { value: 'GRADUATE', label: 'Graduate' },
]

export const BILLING_TYPE_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'None' },
  { value: 'FULL_TIME', label: 'Full-Time' },
  { value: 'FULL_TIME_SCHOLARSHIP', label: 'Full-Time (Scholarship)' },
  { value: 'PART_TIME', label: 'Part-Time' },
  { value: 'EXEMPT', label: 'Exempt' },
]

export const PAYMENT_FREQUENCY_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'None' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'BI_MONTHLY', label: 'Bi-Monthly (Every 2 Months)' },
]
