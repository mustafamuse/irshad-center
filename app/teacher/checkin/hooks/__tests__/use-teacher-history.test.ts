import { act, renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockGetTeacherAttendanceHistory } = vi.hoisted(() => ({
  mockGetTeacherAttendanceHistory: vi.fn(),
}))

vi.mock('../../actions', () => ({
  getTeacherAttendanceHistory: (...args: unknown[]) =>
    mockGetTeacherAttendanceHistory(...args),
}))

import { useTeacherHistory } from '../use-teacher-history'

const emptyHistoryResult = { records: [], monthlyExcuseCount: 0 }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useTeacherHistory', () => {
  describe('stale response guard', () => {
    it('discards in-flight response from previous teacher when teacher changes mid-flight', async () => {
      let resolveFirst!: (v: unknown) => void
      let resolveSecond!: (v: unknown) => void
      // Both teacher A and teacher B requests hang — teacher B's reactive fetch
      // fires during the switch (isOpen is still true in that render cycle), so
      // we must defer it too to keep history null when asserting the stale guard.
      mockGetTeacherAttendanceHistory
        .mockImplementationOnce(
          () =>
            new Promise((res) => {
              resolveFirst = res as (v: unknown) => void
            })
        )
        .mockImplementationOnce(
          () =>
            new Promise((res) => {
              resolveSecond = res as (v: unknown) => void
            })
        )

      const { result, rerender } = renderHook(
        ({ teacherId, sessionToken }) =>
          useTeacherHistory({ teacherId, sessionToken }),
        { initialProps: { teacherId: 'teacher-a', sessionToken: 'tok-a' } }
      )

      // Open panel — starts teacher A's request (hangs)
      await act(() => result.current.handleOpenChange(true))
      expect(mockGetTeacherAttendanceHistory).toHaveBeenCalledOnce()

      // Switch to teacher B — wrap in act to flush the teacherId reset effect,
      // which updates currentTeacherRef.current. Without this, the ref stays at
      // 'teacher-a' when resolveFirst fires and the stale guard doesn't engage.
      await act(async () => {
        rerender({ teacherId: 'teacher-b', sessionToken: 'tok-b' })
      })

      // Resolve teacher A's request with A-specific data
      await act(async () => {
        resolveFirst({
          data: { records: [{ id: 'record-a' }], monthlyExcuseCount: 0 },
        })
      })

      // A's data must not land — both fetches hang so history is null
      expect(result.current.history).toBeNull()

      // Resolve teacher B's request to confirm B's data CAN land (guard is specific to A)
      await act(async () => {
        resolveSecond({ data: emptyHistoryResult })
      })
      expect(result.current.history).toEqual(emptyHistoryResult)
    })
  })

  describe('token-arrives-after-open', () => {
    it('auto-loads when sessionToken arrives after the panel was already opened', async () => {
      mockGetTeacherAttendanceHistory.mockResolvedValue({
        data: emptyHistoryResult,
      })

      const { result, rerender } = renderHook(
        ({ teacherId, sessionToken }) =>
          useTeacherHistory({ teacherId, sessionToken }),
        {
          initialProps: {
            teacherId: 'teacher-a',
            sessionToken: null as string | null,
          },
        }
      )

      // Open panel with no token — loadHistory bails
      await act(() => result.current.handleOpenChange(true))
      expect(mockGetTeacherAttendanceHistory).not.toHaveBeenCalled()

      // Token arrives
      await act(async () => {
        rerender({ teacherId: 'teacher-a', sessionToken: 'tok-a' })
      })

      // Reactive effect should have triggered a fetch
      expect(mockGetTeacherAttendanceHistory).toHaveBeenCalledOnce()
      expect(mockGetTeacherAttendanceHistory).toHaveBeenCalledWith({
        teacherId: 'teacher-a',
        token: 'tok-a',
      })
    })

    it('does NOT re-fetch when token changes but data is already loaded', async () => {
      mockGetTeacherAttendanceHistory.mockResolvedValue({
        data: emptyHistoryResult,
      })

      const { result, rerender } = renderHook(
        ({ teacherId, sessionToken }) =>
          useTeacherHistory({ teacherId, sessionToken }),
        { initialProps: { teacherId: 'teacher-a', sessionToken: 'tok-a' } }
      )

      // Open panel — first load
      await act(() => result.current.handleOpenChange(true))
      expect(mockGetTeacherAttendanceHistory).toHaveBeenCalledOnce()

      // Wait for hasLoaded to be set
      await act(async () => {})

      // Token refreshes (hypothetical)
      await act(async () => {
        rerender({ teacherId: 'teacher-a', sessionToken: 'tok-a-refreshed' })
      })

      // hasLoaded=true prevents a second fetch
      expect(mockGetTeacherAttendanceHistory).toHaveBeenCalledOnce()
    })
  })
})
