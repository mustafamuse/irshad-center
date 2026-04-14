import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockMutate, mockHistoryQuery } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockHistoryQuery: vi.fn(),
}))

vi.mock('@/lib/features/attendance/hooks/teacher', () => ({
  useGetSessionMutation: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
  useTeacherCheckinHistoryQuery: () => mockHistoryQuery(),
}))

vi.mock('@/lib/constants/attendance-status', () => ({
  ATTENDANCE_STATUS_CONFIG: {
    LATE: { label: 'Late', className: '' },
    ABSENT: { label: 'Absent', className: '' },
    PRESENT: { label: 'Present', className: '' },
  },
}))

vi.mock('@/lib/constants/shift-times', () => ({
  SCHOOL_TIMEZONE: 'America/Chicago',
}))

vi.mock('@/lib/utils/format-date', () => ({
  formatWeekendDate: (date: string) => date,
}))

vi.mock('../excuse-form', () => ({
  ExcuseForm: () => <div data-testid="excuse-form" />,
}))

import { CheckinHistory } from '../checkin-history'

const TEACHER_A = '550e8400-e29b-41d4-a716-446655440001'
const TEACHER_B = '550e8400-e29b-41d4-a716-446655440002'

function makeQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

const emptyHistoryState = {
  data: undefined,
  isLoading: false,
  isFetching: false,
  error: null,
}

describe('CheckinHistory', () => {
  beforeEach(() => {
    mockMutate.mockReset()
    mockHistoryQuery.mockReturnValue(emptyHistoryState)
  })

  it('shows PIN prompt when teacher is selected, panel is open, and no token is set', () => {
    render(
      <CheckinHistory
        teacherId={TEACHER_A}
        sessionToken={null}
        isOpen={true}
        onOpenChange={vi.fn()}
        phase2Enabled={true}
      />,
      { wrapper: makeQueryWrapper() }
    )

    expect(screen.getByPlaceholderText('Enter PIN')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /verify pin/i })
    ).toBeInTheDocument()
  })

  it('does not apply a token when the teacher changes during an in-flight PIN request', async () => {
    // Control when the mutation resolves
    let resolveSuccess: ((result: { token: string }) => void) | null = null
    mockMutate.mockImplementation(
      (
        _vars: unknown,
        callbacks: { onSuccess: (r: { token: string }) => void }
      ) => {
        resolveSuccess = callbacks.onSuccess
      }
    )

    const { rerender } = render(
      <CheckinHistory
        teacherId={TEACHER_A}
        sessionToken={null}
        isOpen={true}
        onOpenChange={vi.fn()}
        phase2Enabled={true}
      />,
      { wrapper: makeQueryWrapper() }
    )

    // Enter PIN and submit while on teacher A
    await userEvent.type(screen.getByPlaceholderText('Enter PIN'), 'school-pin')
    await userEvent.click(screen.getByRole('button', { name: /verify pin/i }))
    expect(resolveSuccess).not.toBeNull()

    // Teacher switches to B before the mutation resolves
    rerender(
      <CheckinHistory
        teacherId={TEACHER_B}
        sessionToken={null}
        isOpen={true}
        onOpenChange={vi.fn()}
        phase2Enabled={true}
      />
    )

    // Mutation resolves with teacher A's token
    resolveSuccess!({ token: 'teacher-a-token' })

    // PIN prompt is still shown — token was discarded (stale response guard)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter PIN')).toBeInTheDocument()
    })
  })

  it('preserves a valid token when the history panel is closed and reopened', async () => {
    // Mutation immediately succeeds
    mockMutate.mockImplementation(
      (
        _vars: unknown,
        callbacks: { onSuccess: (r: { token: string }) => void }
      ) => {
        callbacks.onSuccess({ token: 'valid-token' })
      }
    )

    const { rerender } = render(
      <CheckinHistory
        teacherId={TEACHER_A}
        sessionToken={null}
        isOpen={true}
        onOpenChange={vi.fn()}
        phase2Enabled={true}
      />,
      { wrapper: makeQueryWrapper() }
    )

    // Enter PIN and submit
    await userEvent.type(screen.getByPlaceholderText('Enter PIN'), 'pin')
    await userEvent.click(screen.getByRole('button', { name: /verify pin/i }))

    // PIN prompt disappears after successful auth
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Enter PIN')).not.toBeInTheDocument()
    })

    // Close the panel
    rerender(
      <CheckinHistory
        teacherId={TEACHER_A}
        sessionToken={null}
        isOpen={false}
        onOpenChange={vi.fn()}
        phase2Enabled={true}
      />
    )

    // Reopen the panel
    rerender(
      <CheckinHistory
        teacherId={TEACHER_A}
        sessionToken={null}
        isOpen={true}
        onOpenChange={vi.fn()}
        phase2Enabled={true}
      />
    )

    // Token is preserved — PIN prompt does not reappear
    expect(screen.queryByPlaceholderText('Enter PIN')).not.toBeInTheDocument()
  })
})
