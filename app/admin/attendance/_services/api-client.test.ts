import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

import { ApiClient, ApiError, ValidationError } from './api-client'

describe('ApiClient', () => {
  let apiClient: ApiClient
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = mockFetch
    apiClient = ApiClient.getInstance()
  })

  describe('request handling', () => {
    it('handles successful JSON responses', async () => {
      const mockResponse = { success: true, data: { id: 1 } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      })

      const result = await apiClient.get('/test')
      expect(result).toEqual({ id: 1 })
    })

    it('validates response data against schema', async () => {
      const mockResponse = { success: true, data: { id: '1', name: 'Test' } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      })

      const schema = z.object({
        id: z.string(),
        name: z.string(),
      })

      const result = await apiClient.get('/test', {}, schema)
      expect(result).toEqual({ id: '1', name: 'Test' })
    })

    it('throws ValidationError for invalid response data', async () => {
      const mockResponse = { success: true, data: { id: 1 } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      })

      const schema = z.object({
        id: z.string(), // Expecting string but got number
      })

      await expect(apiClient.get('/test', {}, schema)).rejects.toThrow(
        ValidationError
      )
    })

    it('handles non-JSON responses', async () => {
      const mockResponse = 'Plain text response'
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve(mockResponse),
      })

      const result = await apiClient.get('/test')
      expect(result).toBe(mockResponse)
    })

    it('throws ApiError for non-200 responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: 'Not found' }),
      })

      await expect(apiClient.get('/test')).rejects.toThrow(ApiError)
    })

    it('handles request timeout', async () => {
      vi.useFakeTimers()
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 31000) // Longer than default timeout
          })
      )

      const promise = apiClient.get('/test')
      vi.advanceTimersByTime(31000)

      await expect(promise).rejects.toThrow('Request timeout')
      vi.useRealTimers()
    })
  })

  describe('retry behavior', () => {
    it('retries failed requests with exponential backoff', async () => {
      const successResponse = { success: true, data: { id: 1 } }
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve(successResponse),
        })

      const result = await apiClient.retryWithBackoff(() =>
        apiClient.get('/test')
      )
      expect(result).toEqual({ id: 1 })
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('does not retry validation errors', async () => {
      const mockResponse = { success: true, data: { id: 1 } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      })

      const schema = z.object({
        id: z.string(), // Will fail validation
      })

      await expect(
        apiClient.retryWithBackoff(() => apiClient.get('/test', {}, schema))
      ).rejects.toThrow(ValidationError)
      expect(mockFetch).toHaveBeenCalledTimes(1) // No retries
    })

    it('respects max retries limit', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(
        apiClient.retryWithBackoff(() => apiClient.get('/test'), 3)
      ).rejects.toThrow('Network error')
      expect(mockFetch).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })
  })

  describe('HTTP methods', () => {
    it('sends correct headers and body for POST requests', async () => {
      const mockResponse = { success: true, data: { id: 1 } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      })

      const payload = { name: 'Test' }
      await apiClient.post('/test', payload)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(payload),
        })
      )
    })

    it('handles PATCH requests correctly', async () => {
      const mockResponse = { success: true, data: { id: 1 } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      })

      const payload = { name: 'Updated' }
      await apiClient.patch('/test', payload)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      )
    })

    it('sends DELETE requests without body', async () => {
      const mockResponse = { success: true }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      })

      await apiClient.delete('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'DELETE',
          body: undefined,
        })
      )
    })
  })
})
