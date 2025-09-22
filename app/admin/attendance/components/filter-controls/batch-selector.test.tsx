import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { BatchSelector } from './batch-selector'
import { mockBatch } from '../../_tests/test-utils'

describe('BatchSelector', () => {
  const mockOnValueChange = vi.fn()
  const defaultProps = {
    value: undefined,
    onValueChange: mockOnValueChange,
    batches: [],
    isLoading: false,
    error: null,
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows loading state', () => {
    render(<BatchSelector {...defaultProps} isLoading={true} />)
    expect(screen.getByText('Loading batches...')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('shows error state', () => {
    const error = new Error('Failed to load batches')
    render(<BatchSelector {...defaultProps} error={error} />)
    expect(screen.getByText('Failed to load batches')).toBeInTheDocument()
  })

  it('shows empty state when no batches available', () => {
    render(<BatchSelector {...defaultProps} />)
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByText('No batches found')).toBeInTheDocument()
  })

  it('renders batch options', () => {
    const batches = [
      mockBatch({ id: '1', name: 'Batch A' }),
      mockBatch({ id: '2', name: 'Batch B' }),
    ]
    render(<BatchSelector {...defaultProps} batches={batches} />)

    fireEvent.click(screen.getByRole('combobox'))

    expect(screen.getByText('Batch A')).toBeInTheDocument()
    expect(screen.getByText('Batch B')).toBeInTheDocument()
  })

  it('calls onValueChange when batch is selected', () => {
    const batches = [mockBatch({ id: '1', name: 'Batch A' })]
    render(<BatchSelector {...defaultProps} batches={batches} />)

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Batch A'))

    expect(mockOnValueChange).toHaveBeenCalledWith('1')
  })

  it('displays selected batch name', () => {
    const batches = [mockBatch({ id: '1', name: 'Batch A' })]
    render(<BatchSelector {...defaultProps} batches={batches} value="1" />)

    expect(screen.getByRole('combobox')).toHaveTextContent('Batch A')
  })

  it('shows error message when provided', () => {
    const error = new Error('Custom error message')
    render(<BatchSelector {...defaultProps} error={error} />)

    expect(screen.getByText('Custom error message')).toBeInTheDocument()
  })

  it('disables selector when loading', () => {
    render(<BatchSelector {...defaultProps} isLoading={true} />)

    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(screen.getByText('Loading batches...')).toBeInTheDocument()
  })
})
