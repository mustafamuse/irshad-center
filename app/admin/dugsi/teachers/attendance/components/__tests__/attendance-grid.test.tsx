import { Shift } from '@prisma/client'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll } from 'vitest'

vi.mock('../status-override-dialog', () => ({
  StatusOverrideDialog: () => null,
}))

import { AttendanceGrid } from '../attendance-grid'

const teacher = {
  teacherId: 't1',
  name: 'Test Teacher',
  shifts: [Shift.MORNING, Shift.AFTERNOON],
}
const weekendDates = ['2024-01-14']
const closureDates = new Set<string>()

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn()
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

describe('AttendanceGrid — empty cell rendering', () => {
  it('renders — with no title attribute when truncated is false', () => {
    render(
      <AttendanceGrid
        records={[]}
        weekendDates={weekendDates}
        closureDates={closureDates}
        allTeachers={[teacher]}
        truncated={false}
      />
    )

    const emDashes = screen.getAllByText('—')
    expect(emDashes.length).toBeGreaterThan(0)
    for (const el of emDashes) {
      expect(el).not.toHaveAttribute('title')
    }
  })

  it('renders ? with tooltip when truncated is true', () => {
    render(
      <AttendanceGrid
        records={[]}
        weekendDates={weekendDates}
        closureDates={closureDates}
        allTeachers={[teacher]}
        truncated={true}
      />
    )

    const questionMarks = screen.getAllByText('?')
    expect(questionMarks.length).toBeGreaterThan(0)
    for (const el of questionMarks) {
      expect(el).toHaveAttribute('title')
      expect(el.getAttribute('title')).toMatch(
        /incomplete|narrow the date range/i
      )
    }
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })
})
