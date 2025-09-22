import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '../_tests/test-utils'
import { StudentRow } from './student-row'
import { mockStudent } from '../_tests/test-utils'

describe('StudentRow', () => {
  const defaultProps = {
    student: mockStudent(),
    index: 0,
    isSelected: false,
    onSelect: vi.fn(),
    onAttendanceChange: vi.fn(),
    currentStatus: '',
  }

  it('renders student information correctly', () => {
    render(<StudentRow {...defaultProps} />)

    expect(screen.getByText(defaultProps.student.name)).toBeInTheDocument()
    expect(screen.getByText(defaultProps.student.email)).toBeInTheDocument()
    expect(screen.getByText('#01')).toBeInTheDocument()
  })

  it('shows selected state correctly', () => {
    const { rerender } = render(<StudentRow {...defaultProps} />)

    const row = screen.getByRole('button')
    expect(row).not.toHaveClass('bg-muted')

    rerender(<StudentRow {...defaultProps} isSelected={true} />)
    expect(row).toHaveClass('bg-muted')
  })

  it('calls onSelect when clicked', () => {
    render(<StudentRow {...defaultProps} />)

    fireEvent.click(screen.getByRole('button'))
    expect(defaultProps.onSelect).toHaveBeenCalledWith(defaultProps.index)
  })

  it('calls onSelect when pressing Enter or Space', () => {
    render(<StudentRow {...defaultProps} />)

    const row = screen.getByRole('button')
    fireEvent.keyDown(row, { key: 'Enter' })
    fireEvent.keyDown(row, { key: ' ' })

    expect(defaultProps.onSelect).toHaveBeenCalledTimes(2)
  })

  it('shows status badge when status is set', () => {
    const { rerender } = render(<StudentRow {...defaultProps} />)
    expect(screen.queryByText('Present')).not.toBeInTheDocument()

    rerender(<StudentRow {...defaultProps} currentStatus="present" />)
    expect(screen.getByText('Present')).toBeInTheDocument()
  })

  it('calls onAttendanceChange with correct status', () => {
    render(<StudentRow {...defaultProps} />)

    const presentButton = screen.getByText('P')
    fireEvent.click(presentButton)

    expect(defaultProps.onAttendanceChange).toHaveBeenCalledWith(
      defaultProps.student.id,
      'present'
    )
  })

  it('highlights current status button', () => {
    render(<StudentRow {...defaultProps} currentStatus="present" />)

    const presentButton = screen.getByText('P')
    const absentButton = screen.getByText('A')

    expect(presentButton).toHaveClass('bg-primary')
    expect(absentButton).not.toHaveClass('bg-primary')
  })

  it('prevents row selection when clicking status buttons', () => {
    render(<StudentRow {...defaultProps} />)

    const presentButton = screen.getByText('P')
    fireEvent.click(presentButton)

    expect(defaultProps.onSelect).not.toHaveBeenCalled()
  })
})
