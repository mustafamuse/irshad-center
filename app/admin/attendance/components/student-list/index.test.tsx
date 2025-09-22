import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StudentList } from './index'
import { mockStudent } from '../../_tests/test-utils'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock the hooks
vi.mock('../../_hooks/use-attendance', () => ({
  useAttendance: () => ({
    searchQuery: '',
    setSearchQuery: vi.fn(),
    selectedStudentIndex: -1,
    setSelectedStudentIndex: vi.fn(),
    handleAttendanceChange: vi.fn(),
    attendance: {},
  }),
}))

vi.mock('../../_hooks/use-attendance-queries', () => ({
  useStudents: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
}))

describe('StudentList', () => {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows loading skeleton while loading', () => {
    vi.mocked(useStudents).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    render(<StudentList batchId="batch-1" />, { wrapper })
    expect(screen.getByTestId('student-list-skeleton')).toBeInTheDocument()
  })

  it('shows error message on error', () => {
    vi.mocked(useStudents).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load students'),
    })

    render(<StudentList batchId="batch-1" />, { wrapper })
    expect(screen.getByText('Failed to load students')).toBeInTheDocument()
  })

  it('shows empty state when no students', () => {
    vi.mocked(useStudents).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    render(<StudentList batchId="batch-1" />, { wrapper })
    expect(
      screen.getByText('No students found in this batch')
    ).toBeInTheDocument()
  })

  it('renders student list when data is available', () => {
    const mockStudents = [
      mockStudent({ name: 'John Doe' }),
      mockStudent({ name: 'Jane Smith' }),
    ]

    vi.mocked(useStudents).mockReturnValue({
      data: mockStudents,
      isLoading: false,
      error: null,
    })

    render(<StudentList batchId="batch-1" />, { wrapper })
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('filters students based on search query', () => {
    const mockStudents = [
      mockStudent({ name: 'John Doe' }),
      mockStudent({ name: 'Jane Smith' }),
    ]

    vi.mocked(useStudents).mockReturnValue({
      data: mockStudents,
      isLoading: false,
      error: null,
    })

    const { rerender } = render(<StudentList batchId="batch-1" />, { wrapper })

    // Update search query
    vi.mocked(useAttendance).mockReturnValue({
      ...vi.mocked(useAttendance)(),
      searchQuery: 'John',
    })

    rerender(<StudentList batchId="batch-1" />)

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
  })

  it('handles search input changes', () => {
    const setSearchQuery = vi.fn()
    vi.mocked(useAttendance).mockReturnValue({
      ...vi.mocked(useAttendance)(),
      setSearchQuery,
    })

    render(<StudentList batchId="batch-1" />, { wrapper })

    const searchInput = screen.getByPlaceholderText(/search students/i)
    fireEvent.change(searchInput, { target: { value: 'John' } })

    expect(setSearchQuery).toHaveBeenCalledWith('John')
  })

  it('shows correct attendance status', () => {
    const mockStudents = [mockStudent({ id: 'student-1', name: 'John Doe' })]
    vi.mocked(useStudents).mockReturnValue({
      data: mockStudents,
      isLoading: false,
      error: null,
    })

    vi.mocked(useAttendance).mockReturnValue({
      ...vi.mocked(useAttendance)(),
      attendance: { 'student-1': 'present' },
    })

    render(<StudentList batchId="batch-1" />, { wrapper })
    expect(screen.getByText('Present')).toBeInTheDocument()
  })

  it('handles student selection', () => {
    const setSelectedStudentIndex = vi.fn()
    const mockStudents = [mockStudent({ name: 'John Doe' })]

    vi.mocked(useStudents).mockReturnValue({
      data: mockStudents,
      isLoading: false,
      error: null,
    })

    vi.mocked(useAttendance).mockReturnValue({
      ...vi.mocked(useAttendance)(),
      setSelectedStudentIndex,
    })

    render(<StudentList batchId="batch-1" />, { wrapper })
    fireEvent.click(screen.getByText('John Doe'))

    expect(setSelectedStudentIndex).toHaveBeenCalledWith(0)
  })

  it('handles attendance changes', () => {
    const handleAttendanceChange = vi.fn()
    const mockStudents = [mockStudent({ id: 'student-1', name: 'John Doe' })]

    vi.mocked(useStudents).mockReturnValue({
      data: mockStudents,
      isLoading: false,
      error: null,
    })

    vi.mocked(useAttendance).mockReturnValue({
      ...vi.mocked(useAttendance)(),
      handleAttendanceChange,
    })

    render(<StudentList batchId="batch-1" />, { wrapper })
    fireEvent.click(screen.getByText('P'))

    expect(handleAttendanceChange).toHaveBeenCalledWith('student-1', 'present')
  })
})
