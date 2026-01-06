import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

import { useGeolocation } from '../use-geolocation'

const mockGetCurrentPosition = vi.fn()

const mockGeolocation = {
  getCurrentPosition: mockGetCurrentPosition,
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
}

describe('useGeolocation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with null location values', () => {
    const { result } = renderHook(() => useGeolocation())

    expect(result.current.location).toEqual({
      latitude: null,
      longitude: null,
      accuracy: null,
      error: null,
      timestamp: null,
    })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.hasLocation).toBe(false)
    expect(result.current.hasError).toBe(false)
  })

  it('should set isLoading=true when requestLocation is called', async () => {
    mockGetCurrentPosition.mockImplementation(() => {
      // Simulate async behavior - don't call callback immediately
    })

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current.requestLocation()
    })

    expect(result.current.isLoading).toBe(true)
  })

  it('should update location state on successful position', async () => {
    const mockPosition: GeolocationPosition = {
      coords: {
        latitude: 44.9778,
        longitude: -93.265,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: 1704067200000,
      toJSON: () => ({}),
    }

    mockGetCurrentPosition.mockImplementation((success) => {
      success(mockPosition)
    })

    const { result } = renderHook(() => useGeolocation())

    await act(async () => {
      await result.current.requestLocation()
    })

    expect(result.current.location.latitude).toBe(44.9778)
    expect(result.current.location.longitude).toBe(-93.265)
    expect(result.current.location.accuracy).toBe(10)
    expect(result.current.location.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('should set hasLocation=true when location is acquired', async () => {
    const mockPosition: GeolocationPosition = {
      coords: {
        latitude: 44.9778,
        longitude: -93.265,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: 1704067200000,
      toJSON: () => ({}),
    }

    mockGetCurrentPosition.mockImplementation((success) => {
      success(mockPosition)
    })

    const { result } = renderHook(() => useGeolocation())

    await act(async () => {
      await result.current.requestLocation()
    })

    expect(result.current.hasLocation).toBe(true)
  })

  it('should set hasError=true when geolocation fails', async () => {
    const mockError: GeolocationPositionError = {
      code: 1, // PERMISSION_DENIED
      message: 'User denied geolocation',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    }

    mockGetCurrentPosition.mockImplementation((_, error) => {
      error(mockError)
    })

    const { result } = renderHook(() => useGeolocation())

    await act(async () => {
      await result.current.requestLocation()
    })

    expect(result.current.hasError).toBe(true)
    expect(result.current.location.error).toBeTruthy()
    expect(result.current.isLoading).toBe(false)
  })

  it('should handle position unavailable error', async () => {
    const mockError: GeolocationPositionError = {
      code: 2, // POSITION_UNAVAILABLE
      message: 'Position unavailable',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    }

    mockGetCurrentPosition.mockImplementation((_, error) => {
      error(mockError)
    })

    const { result } = renderHook(() => useGeolocation())

    await act(async () => {
      await result.current.requestLocation()
    })

    expect(result.current.hasError).toBe(true)
    expect(result.current.location.error).toContain('Unable to determine')
  })

  it('should handle timeout error', async () => {
    const mockError: GeolocationPositionError = {
      code: 3, // TIMEOUT
      message: 'Timeout',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    }

    mockGetCurrentPosition.mockImplementation((_, error) => {
      error(mockError)
    })

    const { result } = renderHook(() => useGeolocation())

    await act(async () => {
      await result.current.requestLocation()
    })

    expect(result.current.hasError).toBe(true)
    expect(result.current.location.error).toContain('timed out')
  })

  it('should handle browser not supporting geolocation', async () => {
    Object.defineProperty(global.navigator, 'geolocation', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useGeolocation())

    await act(async () => {
      await result.current.requestLocation()
    })

    expect(result.current.hasError).toBe(true)
    expect(result.current.location.error).toContain('not supported')
    expect(result.current.isLoading).toBe(false)
  })

  it('should return location data from requestLocation', async () => {
    const mockPosition: GeolocationPosition = {
      coords: {
        latitude: 44.9778,
        longitude: -93.265,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: 1704067200000,
      toJSON: () => ({}),
    }

    mockGetCurrentPosition.mockImplementation((success) => {
      success(mockPosition)
    })

    const { result } = renderHook(() => useGeolocation())

    let returnedData
    await act(async () => {
      returnedData = await result.current.requestLocation()
    })

    expect(returnedData).toEqual({
      latitude: 44.9778,
      longitude: -93.265,
      accuracy: 10,
      error: null,
      timestamp: 1704067200000,
    })
  })
})
