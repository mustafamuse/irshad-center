import { Shift } from '@prisma/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest'

const {
  mockUseTeacherContextQuery,
  mockUseClockInMutation,
  mockUseClockOutMutation,
  mockUseGeolocation,
  mockUseCheckinOnboarding,
  mockCheckGeofence,
} = vi.hoisted(() => ({
  mockUseTeacherContextQuery: vi.fn(),
  mockUseClockInMutation: vi.fn(),
  mockUseClockOutMutation: vi.fn(),
  mockUseGeolocation: vi.fn(),
  mockUseCheckinOnboarding: vi.fn(),
  mockCheckGeofence: vi.fn(),
}))

vi.mock('../../actions', () => ({
  checkGeofence: (...args: unknown[]) => mockCheckGeofence(...args),
}))

vi.mock('@/lib/features/attendance/hooks/teacher', () => ({
  useTeacherContextQuery: (...args: unknown[]) =>
    mockUseTeacherContextQuery(...args),
  useClockInMutation: (...args: unknown[]) => mockUseClockInMutation(...args),
  useClockOutMutation: (...args: unknown[]) => mockUseClockOutMutation(...args),
  useTeacherCheckinHistoryQuery: vi.fn().mockReturnValue({
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: null,
  }),
  useSubmitExcuseMutation: vi.fn().mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

vi.mock('../use-geolocation', () => ({
  useGeolocation: () => mockUseGeolocation(),
}))

vi.mock('../use-checkin-onboarding', () => ({
  useCheckinOnboarding: () => mockUseCheckinOnboarding(),
}))

import { CheckinForm } from '../checkin-form'

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

const mockTeachers = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Alice Smith',
    email: 'alice@test.com',
    phone: '612-555-0001',
    shifts: [Shift.MORNING, Shift.AFTERNOON],
    todayStatus: 'not_checked_in' as const,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Bob Johnson',
    email: 'bob@test.com',
    phone: '612-555-0002',
    shifts: [Shift.MORNING],
    todayStatus: 'not_checked_in' as const,
  },
]

const defaultGeolocation = {
  location: {
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    timestamp: null,
  },
  isLoading: false,
  requestLocation: vi.fn(),
  hasLocation: false,
  hasError: false,
}

const locationAcquired = {
  location: {
    latitude: 44.9778,
    longitude: -93.265,
    accuracy: 10,
    error: null,
    timestamp: Date.now(),
  },
  isLoading: false,
  requestLocation: vi.fn().mockResolvedValue({
    latitude: 44.9778,
    longitude: -93.265,
    accuracy: 10,
    error: null,
    timestamp: Date.now(),
  }),
  hasLocation: true,
  hasError: false,
}

const defaultContextNotClocked = {
  data: {
    teacherId: '550e8400-e29b-41d4-a716-446655440002',
    todayDate: '2024-01-15',
    shifts: [Shift.MORNING],
    morningCheckinId: null,
    morningClockInTime: null,
    morningClockOutTime: null,
    afternoonCheckinId: null,
    afternoonClockInTime: null,
    afternoonClockOutTime: null,
    sessionToken: null,
  },
  isLoading: false,
  isFetching: false,
  error: null,
}

const defaultClockInMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
}

const defaultClockOutMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn()
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('CheckinForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseGeolocation.mockReturnValue(defaultGeolocation)
    mockUseTeacherContextQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
    })
    mockUseClockInMutation.mockReturnValue({ ...defaultClockInMutation })
    mockUseClockOutMutation.mockReturnValue({ ...defaultClockOutMutation })
    mockUseCheckinOnboarding.mockReturnValue({
      showOnboarding: false,
      dismissOnboarding: vi.fn(),
      resetOnboarding: vi.fn(),
    })
    mockCheckGeofence.mockResolvedValue({
      isWithinGeofence: true,
      distanceMeters: 0,
      allowedRadiusMeters: 200,
    })
    locationAcquired.requestLocation.mockResolvedValue({
      latitude: 44.9778,
      longitude: -93.265,
      accuracy: 10,
      error: null,
      timestamp: Date.now(),
    })
  })

  describe('rendering', () => {
    it('should render teacher selector', () => {
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      expect(screen.getByText('Select Your Name')).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('should not show shift selector before teacher is selected', () => {
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      expect(screen.queryByText('Select Shift')).not.toBeInTheDocument()
    })
  })

  describe('teacher selection', () => {
    it('should show shift selector when teacher has multiple shifts', async () => {
      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)

      const option = screen.getByRole('option', { name: /alice smith/i })
      await user.click(option)

      await waitFor(() => {
        expect(screen.getByText('Select Shift')).toBeInTheDocument()
      })
    })

    it('should not show shift selector when teacher has only one shift', async () => {
      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)

      const option = screen.getByRole('option', { name: /bob johnson/i })
      await user.click(option)

      await waitFor(() => {
        expect(screen.queryByText('Select Shift')).not.toBeInTheDocument()
      })
    })

    it('should show current status card after teacher selection with context data', async () => {
      mockUseTeacherContextQuery.mockReturnValue(defaultContextNotClocked)

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      const option = screen.getByRole('option', { name: /bob johnson/i })
      await user.click(option)

      await waitFor(() => {
        expect(screen.getByText('Current Status')).toBeInTheDocument()
      })
    })

    it('should clear message when teacher is changed', async () => {
      const clockInMutateAsync = vi.fn().mockResolvedValue({
        checkInId: 'checkin-1',
        message: 'Clocked in successfully',
      })
      mockUseClockInMutation.mockReturnValue({
        mutateAsync: clockInMutateAsync,
        isPending: false,
      })
      mockUseTeacherContextQuery.mockReturnValue(defaultContextNotClocked)
      mockUseGeolocation.mockReturnValue(locationAcquired)

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /enable location/i })
        ).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /enable location/i }))

      await waitFor(() => {
        const clockInButton = screen.getByRole('button', { name: /clock in/i })
        expect(clockInButton).not.toBeDisabled()
      })

      await user.click(screen.getByRole('button', { name: /clock in/i }))

      await waitFor(() => {
        expect(screen.getByText('Clocked in successfully')).toBeInTheDocument()
      })

      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /alice smith/i }))

      await waitFor(() => {
        expect(
          screen.queryByText('Clocked in successfully')
        ).not.toBeInTheDocument()
      })
    })
  })

  describe('status display', () => {
    it('should show Not Clocked In badge initially', async () => {
      mockUseTeacherContextQuery.mockReturnValue(defaultContextNotClocked)

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(screen.getByText('Not Clocked In')).toBeInTheDocument()
      })
    })

    it('should show Shift In Progress when clocked in', async () => {
      mockUseTeacherContextQuery.mockReturnValue({
        ...defaultContextNotClocked,
        data: {
          ...defaultContextNotClocked.data,
          morningCheckinId: 'checkin-1',
          morningClockInTime: '2024-01-15T08:25:00.000Z',
        },
      })

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(screen.getByText('Shift In Progress')).toBeInTheDocument()
        expect(screen.getByText(/clocked in at/i)).toBeInTheDocument()
      })
    })

    it('should show Shift Complete when clocked out', async () => {
      mockUseTeacherContextQuery.mockReturnValue({
        ...defaultContextNotClocked,
        data: {
          ...defaultContextNotClocked.data,
          morningCheckinId: 'checkin-1',
          morningClockInTime: '2024-01-15T08:25:00.000Z',
          morningClockOutTime: '2024-01-15T12:00:00.000Z',
        },
      })

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        const completeElements = screen.getAllByText('Shift Complete')
        expect(completeElements.length).toBeGreaterThan(0)
      })
    })
  })

  describe('location handling', () => {
    it('should call requestLocation when Enable Location button clicked', async () => {
      mockUseTeacherContextQuery.mockReturnValue(defaultContextNotClocked)
      const mockRequestLocation = vi.fn()
      mockUseGeolocation.mockReturnValue({
        ...defaultGeolocation,
        requestLocation: mockRequestLocation,
      })

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /enable location/i })
        ).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /enable location/i }))

      expect(mockRequestLocation).toHaveBeenCalled()
    })

    it('should show location error when geolocation fails', async () => {
      mockUseTeacherContextQuery.mockReturnValue(defaultContextNotClocked)
      mockUseGeolocation.mockReturnValue({
        ...defaultGeolocation,
        hasError: true,
        location: {
          ...defaultGeolocation.location,
          error: 'Location permission denied',
        },
      })

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(screen.getByText('Could Not Get Location')).toBeInTheDocument()
      })
    })
  })

  describe('clock in/out buttons', () => {
    it('should disable clock-in button when no location', async () => {
      mockUseTeacherContextQuery.mockReturnValue(defaultContextNotClocked)

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        const clockInButton = screen.getByRole('button', { name: /clock in/i })
        expect(clockInButton).toBeDisabled()
      })
    })

    it('should enable clock-in button when location is acquired and within geofence', async () => {
      mockUseTeacherContextQuery.mockReturnValue(defaultContextNotClocked)
      mockUseGeolocation.mockReturnValue(locationAcquired)

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /enable location/i })
        ).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /enable location/i }))

      await waitFor(() => {
        const clockInButton = screen.getByRole('button', { name: /clock in/i })
        expect(clockInButton).not.toBeDisabled()
      })
    })

    it('should show clock-out button when clocked in', async () => {
      mockUseGeolocation.mockReturnValue(locationAcquired)
      mockUseTeacherContextQuery.mockReturnValue({
        ...defaultContextNotClocked,
        data: {
          ...defaultContextNotClocked.data,
          morningCheckinId: 'checkin-1',
          morningClockInTime: '2024-01-15T08:25:00.000Z',
        },
      })

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /clock out/i })
        ).toBeInTheDocument()
      })
    })
  })

  describe('actions', () => {
    it('should call clockInMutation and show success message', async () => {
      const clockInMutateAsync = vi.fn().mockResolvedValue({
        checkInId: 'checkin-1',
        message: 'Clocked in successfully',
      })
      mockUseClockInMutation.mockReturnValue({
        mutateAsync: clockInMutateAsync,
        isPending: false,
      })
      mockUseTeacherContextQuery.mockReturnValue(defaultContextNotClocked)
      mockUseGeolocation.mockReturnValue(locationAcquired)

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /enable location/i })
        ).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /enable location/i }))

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /clock in/i })
        ).not.toBeDisabled()
      })

      await user.click(screen.getByRole('button', { name: /clock in/i }))

      await waitFor(() => {
        expect(clockInMutateAsync).toHaveBeenCalledWith({
          shift: Shift.MORNING,
          latitude: 44.9778,
          longitude: -93.265,
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Clocked in successfully')).toBeInTheDocument()
      })
    })

    it('should show error message when clock-in throws', async () => {
      const clockInMutateAsync = vi
        .fn()
        .mockRejectedValue(new Error('Not enrolled in Dugsi program'))
      mockUseClockInMutation.mockReturnValue({
        mutateAsync: clockInMutateAsync,
        isPending: false,
      })
      mockUseTeacherContextQuery.mockReturnValue(defaultContextNotClocked)
      mockUseGeolocation.mockReturnValue(locationAcquired)

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /enable location/i })
        ).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /enable location/i }))

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /clock in/i })
        ).not.toBeDisabled()
      })

      await user.click(screen.getByRole('button', { name: /clock in/i }))

      await waitFor(() => {
        expect(
          screen.getByText('Not enrolled in Dugsi program')
        ).toBeInTheDocument()
      })
    })

    it('should call clockOutMutation and show success message', async () => {
      const clockOutMutateAsync = vi.fn().mockResolvedValue({
        message: 'Clocked out successfully',
      })
      mockUseClockOutMutation.mockReturnValue({
        mutateAsync: clockOutMutateAsync,
        isPending: false,
      })
      mockUseGeolocation.mockReturnValue(locationAcquired)
      mockUseTeacherContextQuery.mockReturnValue({
        ...defaultContextNotClocked,
        data: {
          ...defaultContextNotClocked.data,
          morningCheckinId: 'checkin-1',
          morningClockInTime: '2024-01-15T08:25:00.000Z',
        },
      })

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /clock out/i })
        ).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /clock out/i }))

      await waitFor(() => {
        expect(clockOutMutateAsync).toHaveBeenCalledWith({
          checkInId: 'checkin-1',
          latitude: 44.9778,
          longitude: -93.265,
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Clocked out successfully')).toBeInTheDocument()
      })
    })
  })

  describe('teacher switch isolation', () => {
    it('clears message state when teacher is switched', async () => {
      const clockInMutateAsync = vi.fn().mockResolvedValue({
        checkInId: 'checkin-1',
        message: 'Clocked in successfully',
      })
      mockUseClockInMutation.mockReturnValue({
        mutateAsync: clockInMutateAsync,
        isPending: false,
      })
      mockUseTeacherContextQuery.mockReturnValue(defaultContextNotClocked)
      mockUseGeolocation.mockReturnValue(locationAcquired)

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />, {
        wrapper: makeQueryWrapper(),
      })

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /enable location/i })
        ).toBeInTheDocument()
      )
      await user.click(screen.getByRole('button', { name: /enable location/i }))
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /clock in/i })
        ).not.toBeDisabled()
      )
      await user.click(screen.getByRole('button', { name: /clock in/i }))
      await waitFor(() =>
        expect(screen.getByText('Clocked in successfully')).toBeInTheDocument()
      )

      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /alice smith/i }))

      await waitFor(() => {
        expect(
          screen.queryByText('Clocked in successfully')
        ).not.toBeInTheDocument()
      })
    })
  })
})
