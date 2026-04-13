import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGetAttendanceGrid,
  mockGetActiveDugsiTeacherShifts,
  mockListSchoolClosures,
} = vi.hoisted(() => ({
  mockGetAttendanceGrid: vi.fn(),
  mockGetActiveDugsiTeacherShifts: vi.fn(),
  mockListSchoolClosures: vi.fn(),
}))

vi.mock('@/lib/db/queries/teacher-attendance', () => ({
  getAttendanceGrid: (...args: unknown[]) => mockGetAttendanceGrid(...args),
  getActiveDugsiTeacherShifts: (...args: unknown[]) =>
    mockGetActiveDugsiTeacherShifts(...args),
  listSchoolClosures: (...args: unknown[]) => mockListSchoolClosures(...args),
}))

vi.mock('@/lib/utils/date-utils', () => ({
  getWeekendDatesBetween: vi.fn().mockReturnValue(['2024-01-14', '2024-01-07']),
}))

vi.mock('../components/attendance-grid', () => ({
  AttendanceGrid: () => <div data-testid="attendance-grid" />,
}))

import TeacherAttendancePage from '../page'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetActiveDugsiTeacherShifts.mockResolvedValue([])
  mockListSchoolClosures.mockResolvedValue([])
})

describe('TeacherAttendancePage — truncation banner', () => {
  it('renders truncation banner with correct wording when results are capped', async () => {
    mockGetAttendanceGrid.mockResolvedValue({ records: [], truncated: true })

    render(await TeacherAttendancePage())

    expect(
      screen.getByText(/Showing the first 1,000 records/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/narrow the date range/i)).toBeInTheDocument()
  })

  it('does not render truncation banner when results are not capped', async () => {
    mockGetAttendanceGrid.mockResolvedValue({ records: [], truncated: false })

    render(await TeacherAttendancePage())

    expect(
      screen.queryByText(/Showing the first 1,000 records/i)
    ).not.toBeInTheDocument()
  })
})
