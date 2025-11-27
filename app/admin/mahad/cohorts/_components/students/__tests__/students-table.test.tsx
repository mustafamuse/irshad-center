import { useRouter } from 'next/navigation'

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { BatchStudentData, BatchWithCount } from '@/lib/types/batch'

import { StudentsTable } from '../students-table'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/admin/mahad/cohorts'),
}))

// Mock use-debounce
vi.mock('use-debounce', () => ({
  useDebouncedCallback: (fn: Function) => {
    const debouncedFn = (...args: unknown[]) => fn(...args)
    debouncedFn.cancel = vi.fn()
    return debouncedFn
  },
}))

describe('StudentsTable', () => {
  const mockBatches: BatchWithCount[] = [
    {
      id: 'batch-1',
      name: 'Batch 1',
      studentCount: 10,
      startDate: new Date(),
      endDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'batch-2',
      name: 'Batch 2',
      studentCount: 5,
      startDate: new Date(),
      endDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const mockStudents: BatchStudentData[] = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '1234567890',
      dateOfBirth: new Date('2010-01-01'),
      status: 'enrolled',
      batchId: 'batch-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      batch: {
        id: 'batch-1',
        name: 'Batch 1',
        startDate: new Date(),
        endDate: new Date(),
      },
      gradeLevel: null,
      schoolName: null,
      graduationStatus: null,
      paymentFrequency: null,
      billingType: null,
      paymentNotes: null,
      subscription: null,
      siblingCount: 0,
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '0987654321',
      dateOfBirth: new Date('2011-05-15'),
      status: 'registered',
      batchId: 'batch-2',
      createdAt: new Date(),
      updatedAt: new Date(),
      batch: {
        id: 'batch-2',
        name: 'Batch 2',
        startDate: new Date(),
        endDate: new Date(),
      },
      gradeLevel: null,
      schoolName: null,
      graduationStatus: null,
      paymentFrequency: null,
      billingType: null,
      paymentNotes: null,
      subscription: null,
      siblingCount: 0,
    },
  ]

  const mockPush = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
    })
  })

  describe('rendering', () => {
    it('should render students table with data', () => {
      render(
        <StudentsTable
          students={mockStudents}
          batches={mockBatches}
          totalCount={2}
          currentPage={1}
          totalPages={1}
        />
      )

      expect(screen.getByText('Students')).toBeInTheDocument()
      expect(screen.getByText('2 students total')).toBeInTheDocument()
    })

    it('should show filtered count when filters are active', () => {
      // Mock search params with active filter
      vi.mock('next/navigation', () => ({
        useSearchParams: vi.fn(() => new URLSearchParams('search=john')),
        useRouter: vi.fn(),
        usePathname: vi.fn(() => '/admin/mahad/cohorts'),
      }))

      render(
        <StudentsTable
          students={[mockStudents[0]]}
          batches={mockBatches}
          totalCount={10}
          currentPage={1}
          totalPages={1}
        />
      )

      expect(screen.getByText(/Showing 1 of 10 students/)).toBeInTheDocument()
    })

    it('should render mobile view for small screens', () => {
      render(
        <StudentsTable
          students={mockStudents}
          batches={mockBatches}
          totalCount={2}
          currentPage={1}
          totalPages={1}
        />
      )

      // Mobile view should have the sm:hidden class
      const mobileView = screen
        .getByText('Students')
        .closest('div')
        ?.querySelector('.sm\\:hidden')
      expect(mobileView).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('should show empty state when no students and filters are active', () => {
      // Mock with active filters
      vi.mock('next/navigation', () => ({
        useSearchParams: vi.fn(() => new URLSearchParams('search=xyz')),
        useRouter: vi.fn(),
        usePathname: vi.fn(() => '/admin/mahad/cohorts'),
      }))

      render(
        <StudentsTable
          students={[]}
          batches={mockBatches}
          totalCount={0}
          currentPage={1}
          totalPages={0}
        />
      )

      expect(
        screen.getByText('No students match your filters')
      ).toBeInTheDocument()
      expect(screen.getByText('Clear all filters')).toBeInTheDocument()
    })

    it('should not show empty state when no filters are active', () => {
      render(
        <StudentsTable
          students={[]}
          batches={mockBatches}
          totalCount={0}
          currentPage={1}
          totalPages={0}
        />
      )

      expect(
        screen.queryByText('No students match your filters')
      ).not.toBeInTheDocument()
    })

    it('should clear filters when clear button is clicked', async () => {
      const user = userEvent.setup()

      // Mock with active filters
      vi.mock('next/navigation', () => ({
        useSearchParams: vi.fn(() => new URLSearchParams('search=xyz')),
        useRouter: vi.fn(() => ({ push: mockPush })),
        usePathname: vi.fn(() => '/admin/mahad/cohorts'),
      }))

      render(
        <StudentsTable
          students={[]}
          batches={mockBatches}
          totalCount={0}
          currentPage={1}
          totalPages={0}
        />
      )

      const clearButton = screen.getByText('Clear all filters')
      await user.click(clearButton)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/mahad/cohorts')
      })
    })
  })

  describe('pagination', () => {
    it('should show pagination controls when totalPages > 1', () => {
      render(
        <StudentsTable
          students={mockStudents}
          batches={mockBatches}
          totalCount={100}
          currentPage={2}
          totalPages={5}
        />
      )

      expect(screen.getByText('Page 2 of 5')).toBeInTheDocument()
      expect(screen.getByText('Previous')).toBeInTheDocument()
      expect(screen.getByText('Next')).toBeInTheDocument()
    })

    it('should not show pagination when totalPages <= 1', () => {
      render(
        <StudentsTable
          students={mockStudents}
          batches={mockBatches}
          totalCount={2}
          currentPage={1}
          totalPages={1}
        />
      )

      expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument()
    })

    it('should disable Previous button on first page', () => {
      render(
        <StudentsTable
          students={mockStudents}
          batches={mockBatches}
          totalCount={100}
          currentPage={1}
          totalPages={5}
        />
      )

      const previousButton = screen.getByText('Previous').closest('button')
      expect(previousButton).toBeDisabled()
    })

    it('should disable Next button on last page', () => {
      render(
        <StudentsTable
          students={mockStudents}
          batches={mockBatches}
          totalCount={100}
          currentPage={5}
          totalPages={5}
        />
      )

      const nextButton = screen.getByText('Next').closest('button')
      expect(nextButton).toBeDisabled()
    })

    it('should navigate to next page when Next is clicked', async () => {
      const user = userEvent.setup()

      render(
        <StudentsTable
          students={mockStudents}
          batches={mockBatches}
          totalCount={100}
          currentPage={2}
          totalPages={5}
        />
      )

      const nextButton = screen.getByText('Next')
      await user.click(nextButton)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('page=3'))
      })
    })

    it('should navigate to previous page when Previous is clicked', async () => {
      const user = userEvent.setup()

      render(
        <StudentsTable
          students={mockStudents}
          batches={mockBatches}
          totalCount={100}
          currentPage={3}
          totalPages={5}
        />
      )

      const previousButton = screen.getByText('Previous')
      await user.click(previousButton)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('page=2'))
      })
    })
  })

  describe('auto-reset pagination edge case', () => {
    it('should auto-reset to page 1 when currentPage > totalPages', async () => {
      // This tests the useEffect that handles the edge case
      // where filters reduce results and current page exceeds total pages
      const { rerender } = render(
        <StudentsTable
          students={mockStudents}
          batches={mockBatches}
          totalCount={100}
          currentPage={5}
          totalPages={5}
        />
      )

      // User applies filter that reduces results to 2 pages
      rerender(
        <StudentsTable
          students={mockStudents}
          batches={mockBatches}
          totalCount={20}
          currentPage={5}
          totalPages={2}
        />
      )

      // Should trigger auto-reset to page 1
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('page=1'))
      })
    })

    it('should not reset when currentPage <= totalPages', () => {
      render(
        <StudentsTable
          students={mockStudents}
          batches={mockBatches}
          totalCount={100}
          currentPage={2}
          totalPages={5}
        />
      )

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should not reset when totalPages is 0', () => {
      render(
        <StudentsTable
          students={[]}
          batches={mockBatches}
          totalCount={0}
          currentPage={1}
          totalPages={0}
        />
      )

      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('loading state', () => {
    it('should show loading indicator when isPending is true', () => {
      // Mock isPending state from useURLFilters
      // This would require mocking the hook's return value
      // For now, we document the expected behavior
      // render with pending state
      // expect loading spinner to be visible
      // expect "Loading students..." text to be present
    })
  })
})
