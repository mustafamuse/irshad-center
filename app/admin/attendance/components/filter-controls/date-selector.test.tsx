import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { DateSelector } from './date-selector'
import { addDays, subDays } from 'date-fns'

describe('DateSelector', () => {
  const mockOnSelect = vi.fn()
  const defaultProps = {
    selected: undefined,
    onSelect: mockOnSelect,
    className: 'test-class',
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders quick selection buttons', () => {
    render(<DateSelector {...defaultProps} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
    expect(screen.getByText('Tomorrow')).toBeInTheDocument()
  })

  it('shows calendar button with placeholder when no date selected', () => {
    render(<DateSelector {...defaultProps} />)
    expect(screen.getByText('Pick a date')).toBeInTheDocument()
  })

  it('shows formatted date when date is selected', () => {
    const selected = new Date('2025-01-01')
    render(<DateSelector {...defaultProps} selected={selected} />)
    expect(screen.getByText('January 1st, 2025')).toBeInTheDocument()
  })

  it("calls onSelect with today's date when Today button clicked", () => {
    render(<DateSelector {...defaultProps} />)
    fireEvent.click(screen.getByText('Today'))

    const today = new Date()
    const calledDate = mockOnSelect.mock.calls[0][0]

    expect(mockOnSelect).toHaveBeenCalled()
    expect(calledDate.getDate()).toBe(today.getDate())
    expect(calledDate.getMonth()).toBe(today.getMonth())
    expect(calledDate.getFullYear()).toBe(today.getFullYear())
  })

  it("calls onSelect with yesterday's date when Yesterday button clicked", () => {
    render(<DateSelector {...defaultProps} />)
    fireEvent.click(screen.getByText('Yesterday'))

    const yesterday = subDays(new Date(), 1)
    const calledDate = mockOnSelect.mock.calls[0][0]

    expect(mockOnSelect).toHaveBeenCalled()
    expect(calledDate.getDate()).toBe(yesterday.getDate())
    expect(calledDate.getMonth()).toBe(yesterday.getMonth())
    expect(calledDate.getFullYear()).toBe(yesterday.getFullYear())
  })

  it("calls onSelect with tomorrow's date when Tomorrow button clicked", () => {
    render(<DateSelector {...defaultProps} />)
    fireEvent.click(screen.getByText('Tomorrow'))

    const tomorrow = addDays(new Date(), 1)
    const calledDate = mockOnSelect.mock.calls[0][0]

    expect(mockOnSelect).toHaveBeenCalled()
    expect(calledDate.getDate()).toBe(tomorrow.getDate())
    expect(calledDate.getMonth()).toBe(tomorrow.getMonth())
    expect(calledDate.getFullYear()).toBe(tomorrow.getFullYear())
  })

  it('applies custom className', () => {
    const { container } = render(<DateSelector {...defaultProps} />)
    expect(container.querySelector('.test-class')).toBeInTheDocument()
  })

  it('opens calendar popover when calendar button is clicked', () => {
    render(<DateSelector {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /pick a date/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
