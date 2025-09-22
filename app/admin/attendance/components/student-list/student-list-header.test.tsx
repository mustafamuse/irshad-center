import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StudentListHeader } from './student-list-header'

describe('StudentListHeader', () => {
  it('displays total student count', () => {
    render(<StudentListHeader totalCount={10} markedCount={5} />)
    expect(screen.getByText('Students (10)')).toBeInTheDocument()
  })

  it('shows marked count', () => {
    render(<StudentListHeader totalCount={10} markedCount={5} />)
    expect(screen.getByText('5 of 10 marked')).toBeInTheDocument()
  })

  it('calculates and displays progress bar correctly', () => {
    const { container } = render(
      <StudentListHeader totalCount={10} markedCount={5} />
    )
    const progressBar = container.querySelector('.bg-primary') as HTMLElement
    expect(progressBar.style.width).toBe('50%')
  })

  it('handles zero total count', () => {
    const { container } = render(
      <StudentListHeader totalCount={0} markedCount={0} />
    )
    const progressBar = container.querySelector('.bg-primary') as HTMLElement
    expect(progressBar.style.width).toBe('0%')
  })

  it('handles marked count greater than total count', () => {
    const { container } = render(
      <StudentListHeader totalCount={5} markedCount={10} />
    )
    const progressBar = container.querySelector('.bg-primary') as HTMLElement
    expect(progressBar.style.width).toBe('100%')
  })

  it('maintains progress bar structure', () => {
    const { container } = render(
      <StudentListHeader totalCount={10} markedCount={5} />
    )
    expect(container.querySelector('.bg-muted')).toBeInTheDocument()
    expect(container.querySelector('.bg-primary')).toBeInTheDocument()
  })
})
