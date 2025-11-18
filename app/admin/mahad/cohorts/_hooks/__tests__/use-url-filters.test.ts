import { useRouter, useSearchParams, usePathname } from 'next/navigation'

import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { useURLFilters } from '../use-url-filters'

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
  usePathname: vi.fn(),
}))

describe('useURLFilters', () => {
  const mockPush = vi.fn()
  const mockPathname = '/admin/mahad/cohorts'

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
    })
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue(mockPathname)
  })

  describe('getCurrentFilters', () => {
    it('should return default values when no params exist', () => {
      const mockSearchParams = new URLSearchParams()
      ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue(
        mockSearchParams
      )

      const { result } = renderHook(() => useURLFilters())

      expect(result.current.filters).toEqual({
        search: '',
        batchIds: [],
        statuses: [],
        subscriptionStatuses: [],
        educationLevels: [],
        gradeLevels: [],
        page: 1,
        limit: 50,
      })
    })

    it('should parse single values from URL params', () => {
      const mockSearchParams = new URLSearchParams(
        'search=john&batch=batch-1&page=2&limit=25'
      )
      ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue(
        mockSearchParams
      )

      const { result } = renderHook(() => useURLFilters())

      expect(result.current.filters.search).toBe('john')
      expect(result.current.filters.batchIds).toEqual(['batch-1'])
      expect(result.current.filters.page).toBe(2)
      expect(result.current.filters.limit).toBe(25)
    })

    it('should parse multiple values for array params', () => {
      const mockSearchParams = new URLSearchParams()
      mockSearchParams.append('batch', 'batch-1')
      mockSearchParams.append('batch', 'batch-2')
      mockSearchParams.append('status', 'enrolled')
      mockSearchParams.append('status', 'registered')
      ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue(
        mockSearchParams
      )

      const { result } = renderHook(() => useURLFilters())

      expect(result.current.filters.batchIds).toEqual(['batch-1', 'batch-2'])
      expect(result.current.filters.statuses).toEqual([
        'enrolled',
        'registered',
      ])
    })
  })

  describe('setSearch', () => {
    it('should update search param and reset to page 1', () => {
      const mockSearchParams = new URLSearchParams()
      ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue(
        mockSearchParams
      )

      const { result } = renderHook(() => useURLFilters())

      act(() => {
        result.current.setSearch('john doe')
      })

      expect(mockPush).toHaveBeenCalledWith(
        '/admin/mahad/cohorts?search=john+doe'
      )
    })

    it('should remove search param when empty', () => {
      const mockSearchParams = new URLSearchParams('search=john')
      ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue(
        mockSearchParams
      )

      const { result } = renderHook(() => useURLFilters())

      act(() => {
        result.current.setSearch('')
      })

      expect(mockPush).toHaveBeenCalledWith('/admin/mahad/cohorts?')
    })

    it('should preserve other params when updating search', () => {
      const mockSearchParams = new URLSearchParams(
        'batch=batch-1&status=enrolled'
      )
      ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue(
        mockSearchParams
      )

      const { result } = renderHook(() => useURLFilters())

      act(() => {
        result.current.setSearch('john')
      })

      const urlSearchParams = new URLSearchParams(
        mockPush.mock.calls[0][0].split('?')[1]
      )
      expect(urlSearchParams.get('search')).toBe('john')
      expect(urlSearchParams.get('batch')).toBe('batch-1')
      expect(urlSearchParams.get('status')).toBe('enrolled')
    })
  })

  describe('toggleBatch', () => {
    it('should add batch when not present', () => {
      const mockSearchParams = new URLSearchParams()
      ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue(
        mockSearchParams
      )

      const { result } = renderHook(() => useURLFilters())

      act(() => {
        result.current.toggleBatch('batch-1')
      })

      expect(mockPush).toHaveBeenCalledWith(
        '/admin/mahad/cohorts?batch=batch-1'
      )
    })

    it('should remove batch when already present', () => {
      const mockSearchParams = new URLSearchParams()
      mockSearchParams.append('batch', 'batch-1')
      mockSearchParams.append('batch', 'batch-2')
      ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue(
        mockSearchParams
      )

      const { result } = renderHook(() => useURLFilters())

      act(() => {
        result.current.toggleBatch('batch-1')
      })

      const urlSearchParams = new URLSearchParams(
        mockPush.mock.calls[0][0].split('?')[1]
      )
      expect(urlSearchParams.getAll('batch')).toEqual(['batch-2'])
    })

    it('should reset to page 1 when toggling batch', () => {
      const mockSearchParams = new URLSearchParams('page=3')
      ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue(
        mockSearchParams
      )

      const { result } = renderHook(() => useURLFilters())

      act(() => {
        result.current.toggleBatch('batch-1')
      })

      const urlSearchParams = new URLSearchParams(
        mockPush.mock.calls[0][0].split('?')[1]
      )
      expect(urlSearchParams.has('page')).toBe(false) // page param removed (defaults to 1)
    })
  })

  describe('setPage', () => {
    it('should update page param', () => {
      const mockSearchParams = new URLSearchParams()
      ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue(
        mockSearchParams
      )

      const { result } = renderHook(() => useURLFilters())

      act(() => {
        result.current.setPage(3)
      })

      expect(mockPush).toHaveBeenCalledWith('/admin/mahad/cohorts?page=3')
    })

    it('should preserve other params when changing page', () => {
      const mockSearchParams = new URLSearchParams('search=john&batch=batch-1')
      ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue(
        mockSearchParams
      )

      const { result } = renderHook(() => useURLFilters())

      act(() => {
        result.current.setPage(2)
      })

      const urlSearchParams = new URLSearchParams(
        mockPush.mock.calls[0][0].split('?')[1]
      )
      expect(urlSearchParams.get('page')).toBe('2')
      expect(urlSearchParams.get('search')).toBe('john')
      expect(urlSearchParams.get('batch')).toBe('batch-1')
    })
  })

  describe('resetFilters', () => {
    it('should clear all params', () => {
      const mockSearchParams = new URLSearchParams(
        'search=john&batch=batch-1&status=enrolled&page=3'
      )
      ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue(
        mockSearchParams
      )

      const { result } = renderHook(() => useURLFilters())

      act(() => {
        result.current.resetFilters()
      })

      expect(mockPush).toHaveBeenCalledWith('/admin/mahad/cohorts')
    })
  })

  describe('isPending state', () => {
    it('should initially be false', () => {
      const mockSearchParams = new URLSearchParams()
      ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue(
        mockSearchParams
      )

      const { result } = renderHook(() => useURLFilters())

      expect(result.current.isPending).toBe(false)
    })

    it('should be true during transition', async () => {
      const mockSearchParams = new URLSearchParams()
      ;(useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue(
        mockSearchParams
      )

      const { result } = renderHook(() => useURLFilters())

      act(() => {
        result.current.setSearch('john')
      })

      await waitFor(() => {
        expect(result.current.isPending).toBe(false)
      })
    })
  })
})
