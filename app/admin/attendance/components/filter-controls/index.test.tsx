import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterControls } from './index'
import { mockBatch } from '../../_tests/test-utils'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock the hooks
vi.mock('../../_hooks/use-attendance-queries', () => ({
  useStudents: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
}))

describe('FilterControls', () => {
  const mockOnDateSelect = vi.fn()
  const mockOnBatchSelect = vi.fn()
  const mockOnProceed = vi.fn()
  const defaultProps = {
    selectedDate: undefined,
    selectedBatchId: undefined,
    onDateSelect: mockOnDateSelect,
    onBatchSelect: mockOnBatchSelect,
    onProceed: mockOnProceed,
  }

  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders date and batch selection cards', () => {
    render(<FilterControls {...defaultProps} />, { wrapper })

    expect(screen.getByText('Select Date')).toBeInTheDocument()
    expect(screen.getByText('Select Batch')).toBeInTheDocument()
  })

  it('disables proceed button when no date selected', () => {
    render(<FilterControls {...defaultProps} selectedBatchId="batch-1" />, {
      wrapper,
    })

    expect(
      screen.getByRole('button', { name: /proceed to mark attendance/i })
    ).toBeDisabled()
  })

  it('disables proceed button when no batch selected', () => {
    render(<FilterControls {...defaultProps} selectedDate={new Date()} />, {
      wrapper,
    })

    expect(
      screen.getByRole('button', { name: /proceed to mark attendance/i })
    ).toBeDisabled()
  })

  it('enables proceed button when both date and batch are selected', () => {
    render(
      <FilterControls
        {...defaultProps}
        selectedDate={new Date()}
        selectedBatchId="batch-1"
      />,
      { wrapper }
    )

    expect(
      screen.getByRole('button', { name: /proceed to mark attendance/i })
    ).toBeEnabled()
  })

  it('calls onProceed when proceed button is clicked', () => {
    render(
      <FilterControls
        {...defaultProps}
        selectedDate={new Date()}
        selectedBatchId="batch-1"
      />,
      { wrapper }
    )

    fireEvent.click(
      screen.getByRole('button', { name: /proceed to mark attendance/i })
    )
    expect(mockOnProceed).toHaveBeenCalled()
  })

  it('shows loading skeleton when batches are loading', () => {
    vi.mocked(useStudents).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    render(<FilterControls {...defaultProps} />, { wrapper })
    expect(screen.getByTestId('filter-controls-skeleton')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <FilterControls {...defaultProps} className="custom-class" />,
      { wrapper }
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('handles batch selection', () => {
    const batches = [mockBatch({ id: '1', name: 'Batch A' })]
    vi.mocked(useStudents).mockReturnValue({
      data: batches,
      isLoading: false,
      error: null,
    })

    render(<FilterControls {...defaultProps} />, { wrapper })

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Batch A'))

    expect(mockOnBatchSelect).toHaveBeenCalledWith('1')
  })

  it('handles date selection', () => {
    render(<FilterControls {...defaultProps} />, { wrapper })

    fireEvent.click(screen.getByText('Today'))

    expect(mockOnDateSelect).toHaveBeenCalled()
    expect(mockOnDateSelect.mock.calls[0][0]).toBeInstanceOf(Date)
  })
})
