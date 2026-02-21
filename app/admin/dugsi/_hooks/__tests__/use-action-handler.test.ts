/**
 * useActionHandler Hook Tests
 *
 * Tests for the action handler hook that manages server action execution
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { ActionResult } from '../../_types'
import { useActionHandler } from '../use-action-handler'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

describe('useActionHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('should return execute function and isPending false', () => {
      const mockAction = vi.fn()
      const { result } = renderHook(() => useActionHandler(mockAction))

      expect(typeof result.current.execute).toBe('function')
      expect(result.current.isPending).toBe(false)
    })
  })

  describe('successful action execution', () => {
    it('should call action and trigger onSuccess callback', async () => {
      const mockAction = vi.fn().mockResolvedValue({
        success: true,
        data: { id: '123' },
      } as ActionResult<{ id: string }>)

      const onSuccess = vi.fn()

      const { result } = renderHook(() =>
        useActionHandler(mockAction, { onSuccess, refreshOnSuccess: false })
      )

      await act(async () => {
        result.current.execute()
      })

      await waitFor(() => {
        expect(mockAction).toHaveBeenCalled()
        expect(onSuccess).toHaveBeenCalledWith({ id: '123' })
      })
    })

    it('should pass arguments to action', async () => {
      const mockAction = vi.fn().mockResolvedValue({
        success: true,
      } as ActionResult)

      const { result } = renderHook(() =>
        useActionHandler(mockAction, { refreshOnSuccess: false })
      )

      await act(async () => {
        result.current.execute('arg1', 'arg2')
      })

      await waitFor(() => {
        expect(mockAction).toHaveBeenCalledWith('arg1', 'arg2')
      })
    })

    it('should call optimisticUpdate before action executes', async () => {
      const callOrder: string[] = []

      const mockAction = vi.fn().mockImplementation(async () => {
        callOrder.push('action')
        return { success: true } as ActionResult
      })

      const optimisticUpdate = vi.fn().mockImplementation(() => {
        callOrder.push('optimistic')
      })

      const { result } = renderHook(() =>
        useActionHandler(mockAction, {
          optimisticUpdate,
          refreshOnSuccess: false,
        })
      )

      await act(async () => {
        result.current.execute()
      })

      await waitFor(() => {
        expect(callOrder[0]).toBe('optimistic')
        expect(callOrder[1]).toBe('action')
      })
    })
  })

  describe('partial success with warning', () => {
    it('should call toast.warning when result has warning field', async () => {
      const { toast } = await import('sonner')
      const mockAction = vi.fn().mockResolvedValue({
        success: true,
        data: { id: '123' },
        warning: 'Billing update failed',
      } as ActionResult<{ id: string }>)

      const { result } = renderHook(() =>
        useActionHandler(mockAction, { refreshOnSuccess: false })
      )

      await act(async () => {
        result.current.execute()
      })

      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith('Billing update failed', {
          duration: 10000,
        })
        expect(toast.success).not.toHaveBeenCalled()
      })
    })

    it('should still call onSuccess when result has warning', async () => {
      const mockAction = vi.fn().mockResolvedValue({
        success: true,
        data: { id: '123' },
        warning: 'Billing update failed',
      } as ActionResult<{ id: string }>)

      const onSuccess = vi.fn()

      const { result } = renderHook(() =>
        useActionHandler(mockAction, { onSuccess, refreshOnSuccess: false })
      )

      await act(async () => {
        result.current.execute()
      })

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith({ id: '123' })
      })
    })
  })

  describe('failed action execution', () => {
    it('should call onError callback on failure', async () => {
      const mockAction = vi.fn().mockResolvedValue({
        success: false,
        error: 'Something went wrong',
      } as ActionResult)

      const onError = vi.fn()

      const { result } = renderHook(() =>
        useActionHandler(mockAction, { onError, refreshOnSuccess: false })
      )

      await act(async () => {
        result.current.execute()
      })

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Something went wrong')
      })
    })

    it('should call rollback on failure', async () => {
      const mockAction = vi.fn().mockResolvedValue({
        success: false,
        error: 'Failed',
      } as ActionResult)

      const rollback = vi.fn()

      const { result } = renderHook(() =>
        useActionHandler(mockAction, { rollback, refreshOnSuccess: false })
      )

      await act(async () => {
        result.current.execute()
      })

      await waitFor(() => {
        expect(rollback).toHaveBeenCalled()
      })
    })
  })

  describe('exception handling', () => {
    it('should call rollback when action throws', async () => {
      const mockAction = vi.fn().mockRejectedValue(new Error('Network error'))

      const rollback = vi.fn()

      const { result } = renderHook(() =>
        useActionHandler(mockAction, { rollback, refreshOnSuccess: false })
      )

      await act(async () => {
        result.current.execute()
      })

      await waitFor(() => {
        expect(rollback).toHaveBeenCalled()
      })
    })

    it('should call onError with error message when action throws', async () => {
      const mockAction = vi.fn().mockRejectedValue(new Error('Network error'))

      const onError = vi.fn()

      const { result } = renderHook(() =>
        useActionHandler(mockAction, { onError, refreshOnSuccess: false })
      )

      await act(async () => {
        result.current.execute()
      })

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Network error')
      })
    })
  })

  describe('typed actions', () => {
    it('should work with typed action parameters', async () => {
      interface UpdateParams {
        id: string
        name: string
      }

      const mockAction = vi.fn().mockResolvedValue({
        success: true,
        data: { updated: true },
      } as ActionResult<{ updated: boolean }>)

      const { result } = renderHook(() =>
        useActionHandler<{ updated: boolean }, [UpdateParams]>(mockAction, {
          refreshOnSuccess: false,
        })
      )

      await act(async () => {
        result.current.execute({ id: '123', name: 'Test' })
      })

      await waitFor(() => {
        expect(mockAction).toHaveBeenCalledWith({ id: '123', name: 'Test' })
      })
    })
  })
})
