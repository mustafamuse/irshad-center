import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StatusBadge } from './status-badge'

describe('StatusBadge', () => {
  it('renders with correct text', () => {
    const { getByText } = render(<StatusBadge status="present" />)
    expect(getByText('Present')).toBeInTheDocument()
  })

  it('applies correct color classes for present status', () => {
    const { container } = render(<StatusBadge status="present" />)
    const badge = container.firstChild as HTMLElement
    expect(badge).toHaveClass('bg-green-100', 'text-green-700')
  })

  it('applies correct color classes for absent status', () => {
    const { container } = render(<StatusBadge status="absent" />)
    const badge = container.firstChild as HTMLElement
    expect(badge).toHaveClass('bg-red-100', 'text-red-700')
  })

  it('applies correct color classes for late status', () => {
    const { container } = render(<StatusBadge status="late" />)
    const badge = container.firstChild as HTMLElement
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-700')
  })

  it('applies correct color classes for excused status', () => {
    const { container } = render(<StatusBadge status="excused" />)
    const badge = container.firstChild as HTMLElement
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-700')
  })

  it('capitalizes first letter of status', () => {
    const { getByText } = render(<StatusBadge status="present" />)
    expect(getByText('Present')).toBeInTheDocument()
  })
})
