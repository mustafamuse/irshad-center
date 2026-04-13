import { Shift } from '@prisma/client'
import { act, renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockTeacherClockInAction } = vi.hoisted(() => ({
  mockTeacherClockInAction: vi.fn(),
}))

vi.mock('../../actions', () => ({
  teacherClockInAction: (...args: unknown[]) =>
    mockTeacherClockInAction(...args),
  teacherClockOutAction: vi.fn(),
}))

import { useClockInOut } from '../use-clock-in-out'

const defaultParams = {
  shift: Shift.MORNING,
  locationCoords: { latitude: 44.9778, longitude: -93.265 },
  currentCheckinId: null,
  onClockIn: vi.fn(),
  onClockOut: vi.fn(),
  onError: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useClockInOut', () => {
  describe('stale response guard', () => {
    it('does not call onClockIn when teacher changes before clock-in response resolves', async () => {
      let resolveClockIn!: (v: unknown) => void
      mockTeacherClockInAction.mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveClockIn = res as (v: unknown) => void
          })
      )

      const onClockIn = vi.fn()
      const onError = vi.fn()

      const { result, rerender } = renderHook(
        ({ teacherId }) =>
          useClockInOut({ ...defaultParams, teacherId, onClockIn, onError }),
        { initialProps: { teacherId: 'teacher-a' } }
      )

      // Dispatch clock-in for teacher A — hangs
      act(() => result.current.handleClockIn())

      // Switch to teacher B
      rerender({ teacherId: 'teacher-b' })

      // Resolve teacher A's clock-in with success
      await act(async () => {
        resolveClockIn({
          data: {
            status: {
              morningCheckinId: 'a-checkin',
              morningClockInTime: new Date(),
            },
            message: 'Clocked in',
          },
        })
      })

      // A's success must not call onClockIn under teacher B
      expect(onClockIn).not.toHaveBeenCalled()
    })

    it('does not call onError when teacher changes before a failed clock-in response resolves', async () => {
      let resolveClockIn!: (v: unknown) => void
      mockTeacherClockInAction.mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveClockIn = res as (v: unknown) => void
          })
      )

      const onError = vi.fn()

      const { result, rerender } = renderHook(
        ({ teacherId }) =>
          useClockInOut({ ...defaultParams, teacherId, onError }),
        { initialProps: { teacherId: 'teacher-a' } }
      )

      // Dispatch clock-in for teacher A — hangs
      act(() => result.current.handleClockIn())

      // Switch to teacher B
      rerender({ teacherId: 'teacher-b' })

      // Resolve teacher A's clock-in with an error
      await act(async () => {
        resolveClockIn({ serverError: 'Not enrolled in Dugsi program' })
      })

      // A's error must not surface under teacher B
      expect(onError).not.toHaveBeenCalled()
    })
  })
})
