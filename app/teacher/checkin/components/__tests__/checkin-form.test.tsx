import { Shift } from '@prisma/client'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest'

const {
  mockGetTeacherCurrentStatus,
  mockTeacherClockInAction,
  mockTeacherClockOutAction,
  mockCheckGeofence,
  mockUseGeolocation,
  mockUseCheckinOnboarding,
} = vi.hoisted(() => ({
  mockGetTeacherCurrentStatus: vi.fn(),
  mockTeacherClockInAction: vi.fn(),
  mockTeacherClockOutAction: vi.fn(),
  mockCheckGeofence: vi.fn(),
  mockUseGeolocation: vi.fn(),
  mockUseCheckinOnboarding: vi.fn(),
}))

vi.mock('../../actions', () => ({
  getTeacherCurrentStatus: (...args: unknown[]) =>
    mockGetTeacherCurrentStatus(...args),
  teacherClockInAction: (...args: unknown[]) =>
    mockTeacherClockInAction(...args),
  teacherClockOutAction: (...args: unknown[]) =>
    mockTeacherClockOutAction(...args),
  checkGeofence: (...args: unknown[]) => mockCheckGeofence(...args),
}))

vi.mock('../use-geolocation', () => ({
  useGeolocation: () => mockUseGeolocation(),
}))

vi.mock('../use-checkin-onboarding', () => ({
  useCheckinOnboarding: () => mockUseCheckinOnboarding(),
}))

import { CheckinForm } from '../checkin-form'

const mockTeachers = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Alice Smith',
    email: 'alice@test.com',
    phone: '612-555-0001',
    shifts: [Shift.MORNING, Shift.AFTERNOON],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Bob Johnson',
    email: 'bob@test.com',
    phone: '612-555-0002',
    shifts: [Shift.MORNING],
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
  requestLocation: vi.fn(),
  hasLocation: true,
  hasError: false,
}

const defaultStatus = {
  morningCheckinId: null,
  morningClockInTime: null,
  morningClockOutTime: null,
  afternoonCheckinId: null,
  afternoonClockInTime: null,
  afternoonClockOutTime: null,
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
    mockGetTeacherCurrentStatus.mockResolvedValue(defaultStatus)
    mockCheckGeofence.mockResolvedValue({
      isWithinGeofence: true,
      distanceMeters: 25,
      allowedRadiusMeters: 50,
    })
    mockUseCheckinOnboarding.mockReturnValue({
      showOnboarding: false,
      dismissOnboarding: vi.fn(),
      resetOnboarding: vi.fn(),
    })
  })

  describe('rendering', () => {
    it('should render teacher selector', () => {
      render(<CheckinForm teachers={mockTeachers} />)

      expect(screen.getByText('Select Your Name')).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('should not show shift selector before teacher is selected', () => {
      render(<CheckinForm teachers={mockTeachers} />)

      expect(screen.queryByText('Select Shift')).not.toBeInTheDocument()
    })
  })

  describe('teacher selection', () => {
    it('should show shift selector when teacher has multiple shifts', async () => {
      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)

      const option = screen.getByRole('option', { name: /alice smith/i })
      await user.click(option)

      await waitFor(() => {
        expect(screen.getByText('Select Shift')).toBeInTheDocument()
      })
    })

    it('should auto-select shift when teacher has only one shift', async () => {
      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)

      const option = screen.getByRole('option', { name: /bob johnson/i })
      await user.click(option)

      await waitFor(() => {
        expect(screen.queryByText('Select Shift')).not.toBeInTheDocument()
        expect(screen.getByText('Current Status')).toBeInTheDocument()
      })
    })

    it('should show current status card after teacher selection', async () => {
      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)

      const option = screen.getByRole('option', { name: /bob johnson/i })
      await user.click(option)

      await waitFor(() => {
        expect(screen.getByText('Current Status')).toBeInTheDocument()
      })
    })

    it('should clear message when teacher is changed', async () => {
      mockUseGeolocation.mockReturnValue(locationAcquired)
      mockTeacherClockInAction.mockResolvedValue({
        success: true,
        data: { checkInId: 'checkin-1', status: defaultStatus },
        message: 'Clocked in successfully',
      })

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(screen.getByText('Clock In')).toBeInTheDocument()
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
      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(screen.getByText('Not Clocked In')).toBeInTheDocument()
      })
    })

    it('should show Clocked In badge with time when clocked in', async () => {
      const clockedInStatus = {
        ...defaultStatus,
        morningCheckinId: 'checkin-1',
        morningClockInTime: new Date('2024-01-15T08:25:00'),
      }
      mockGetTeacherCurrentStatus.mockResolvedValue(clockedInStatus)

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(screen.getByText('Clocked In')).toBeInTheDocument()
        expect(screen.getByText(/since/i)).toBeInTheDocument()
      })
    })

    it('should show Shift Complete when clocked out', async () => {
      const completedStatus = {
        ...defaultStatus,
        morningCheckinId: 'checkin-1',
        morningClockInTime: new Date('2024-01-15T08:25:00'),
        morningClockOutTime: new Date('2024-01-15T12:00:00'),
      }
      mockGetTeacherCurrentStatus.mockResolvedValue(completedStatus)

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

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
    it('should call requestLocation when Get Location button clicked', async () => {
      const mockRequestLocation = vi.fn().mockResolvedValue({
        latitude: 44.9778,
        longitude: -93.265,
        accuracy: 10,
        error: null,
        timestamp: Date.now(),
      })
      mockUseGeolocation.mockReturnValue({
        ...defaultGeolocation,
        requestLocation: mockRequestLocation,
      })

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /get location/i })
        ).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /get location/i }))

      expect(mockRequestLocation).toHaveBeenCalled()
    })

    it('should show Location acquired when location is obtained', async () => {
      mockUseGeolocation.mockReturnValue(locationAcquired)

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(screen.getByText('Location acquired')).toBeInTheDocument()
      })
    })

    it('should show geofence warning when outside radius', async () => {
      const mockRequestLocation = vi.fn().mockResolvedValue({
        latitude: 45.0,
        longitude: -93.0,
        accuracy: 10,
        error: null,
        timestamp: Date.now(),
      })
      mockUseGeolocation.mockReturnValue({
        ...locationAcquired,
        requestLocation: mockRequestLocation,
      })
      mockCheckGeofence.mockResolvedValue({
        isWithinGeofence: false,
        distanceMeters: 150,
        allowedRadiusMeters: 50,
      })

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /update location/i })
        ).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /update location/i }))

      await waitFor(() => {
        expect(screen.getByText(/150m away/i)).toBeInTheDocument()
      })
    })

    it('should show location error when geolocation fails', async () => {
      mockUseGeolocation.mockReturnValue({
        ...defaultGeolocation,
        hasError: true,
        location: {
          ...defaultGeolocation.location,
          error: 'Location permission denied',
        },
      })

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(screen.getByText('Location Error')).toBeInTheDocument()
        expect(
          screen.getByText('Location permission denied')
        ).toBeInTheDocument()
      })
    })
  })

  describe('clock in/out buttons', () => {
    it('should disable clock-in button when no location', async () => {
      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        const clockInButton = screen.getByRole('button', { name: /clock in/i })
        expect(clockInButton).toBeDisabled()
      })
    })

    it('should enable clock-in button when location is acquired', async () => {
      mockUseGeolocation.mockReturnValue(locationAcquired)

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        const clockInButton = screen.getByRole('button', { name: /clock in/i })
        expect(clockInButton).not.toBeDisabled()
      })
    })

    it('should show clock-out button when clocked in', async () => {
      mockUseGeolocation.mockReturnValue(locationAcquired)
      const clockedInStatus = {
        ...defaultStatus,
        morningCheckinId: 'checkin-1',
        morningClockInTime: new Date('2024-01-15T08:25:00'),
      }
      mockGetTeacherCurrentStatus.mockResolvedValue(clockedInStatus)

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

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
    it('should call teacherClockInAction and show success message', async () => {
      mockUseGeolocation.mockReturnValue(locationAcquired)
      mockTeacherClockInAction.mockResolvedValue({
        success: true,
        data: {
          checkInId: 'checkin-1',
          status: {
            ...defaultStatus,
            morningCheckinId: 'checkin-1',
            morningClockInTime: new Date(),
          },
        },
        message: 'Clocked in successfully',
      })

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /clock in/i })
        ).not.toBeDisabled()
      })

      await user.click(screen.getByRole('button', { name: /clock in/i }))

      await waitFor(() => {
        expect(mockTeacherClockInAction).toHaveBeenCalledWith({
          teacherId: '550e8400-e29b-41d4-a716-446655440002',
          shift: Shift.MORNING,
          latitude: 44.9778,
          longitude: -93.265,
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Clocked in successfully')).toBeInTheDocument()
      })
    })

    it('should show error message when clock-in fails', async () => {
      mockUseGeolocation.mockReturnValue(locationAcquired)
      mockTeacherClockInAction.mockResolvedValue({
        success: false,
        error: 'Not enrolled in Dugsi program',
      })

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

      const combobox = screen.getByRole('combobox')
      await user.click(combobox)
      await user.click(screen.getByRole('option', { name: /bob johnson/i }))

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

    it('should call teacherClockOutAction and update status', async () => {
      mockUseGeolocation.mockReturnValue(locationAcquired)
      const clockedInStatus = {
        ...defaultStatus,
        morningCheckinId: 'checkin-1',
        morningClockInTime: new Date('2024-01-15T08:25:00'),
      }
      const clockedOutStatus = {
        ...clockedInStatus,
        morningClockOutTime: new Date('2024-01-15T12:00:00'),
      }
      mockGetTeacherCurrentStatus.mockResolvedValue(clockedInStatus)
      mockTeacherClockOutAction.mockResolvedValue({
        success: true,
        data: { status: clockedOutStatus },
        message: 'Clocked out successfully',
      })

      const user = userEvent.setup()
      render(<CheckinForm teachers={mockTeachers} />)

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
        expect(mockTeacherClockOutAction).toHaveBeenCalledWith({
          checkInId: 'checkin-1',
          teacherId: '550e8400-e29b-41d4-a716-446655440002',
          latitude: 44.9778,
          longitude: -93.265,
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Clocked out successfully')).toBeInTheDocument()
      })
    })
  })
})
