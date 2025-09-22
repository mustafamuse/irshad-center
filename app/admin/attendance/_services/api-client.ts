import { z } from 'zod'

interface ApiClientConfig {
  baseUrl?: string
  headers?: Record<string, string>
  timeout?: number
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

interface RequestConfig extends RequestInit {
  timeout?: number
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: z.ZodError
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ApiClient {
  private static instance: ApiClient
  private baseUrl: string
  private defaultHeaders: Record<string, string>
  private defaultTimeout: number

  private constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || ''
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    }
    this.defaultTimeout = config.timeout || 30000 // 30 seconds default
  }

  public static getInstance(config?: ApiClientConfig): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient(config)
    }
    return ApiClient.instance
  }

  /**
   * Make an API request with timeout and error handling
   */
  private async request<T>(
    url: string,
    config: RequestConfig = {},
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    const controller = new AbortController()
    const timeout = config.timeout || this.defaultTimeout
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(this.baseUrl + url, {
        ...config,
        headers: {
          ...this.defaultHeaders,
          ...config.headers,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const contentType = response.headers.get('content-type')
      const isJson = contentType?.includes('application/json')
      const data = isJson ? await response.json() : await response.text()

      if (!response.ok) {
        throw new ApiError(
          data.error || 'An error occurred',
          response.status,
          data
        )
      }

      // For our API responses that follow the ApiResponse interface
      if (isJson && typeof data === 'object' && 'success' in data) {
        const apiResponse = data as ApiResponse<T>
        if (!apiResponse.success) {
          throw new ApiError(apiResponse.error || 'API request failed')
        }
        if (schema && apiResponse.data) {
          try {
            return schema.parse(apiResponse.data)
          } catch (error) {
            if (error instanceof z.ZodError) {
              throw new ValidationError('Response validation failed', error)
            }
            throw error
          }
        }
        return apiResponse.data as T
      }

      // For direct data responses
      if (schema) {
        try {
          return schema.parse(data)
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new ValidationError('Response validation failed', error)
          }
          throw error
        }
      }

      return data as T
    } catch (error) {
      if (error instanceof ApiError || error instanceof ValidationError) {
        throw error
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError('Request timeout')
      }
      throw new ApiError(
        error instanceof Error ? error.message : 'An unknown error occurred'
      )
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Make a GET request
   */
  public async get<T>(
    url: string,
    config: RequestConfig = {},
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    return this.request<T>(url, { ...config, method: 'GET' }, schema)
  }

  /**
   * Make a POST request
   */
  public async post<T>(
    url: string,
    data?: unknown,
    config: RequestConfig = {},
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    return this.request<T>(
      url,
      {
        ...config,
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      },
      schema
    )
  }

  /**
   * Make a PATCH request
   */
  public async patch<T>(
    url: string,
    data?: unknown,
    config: RequestConfig = {},
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    return this.request<T>(
      url,
      {
        ...config,
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
      },
      schema
    )
  }

  /**
   * Make a DELETE request
   */
  public async delete<T>(
    url: string,
    config: RequestConfig = {},
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    return this.request<T>(url, { ...config, method: 'DELETE' }, schema)
  }

  /**
   * Make a PUT request
   */
  public async put<T>(
    url: string,
    data?: unknown,
    config: RequestConfig = {},
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    return this.request<T>(
      url,
      {
        ...config,
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
      },
      schema
    )
  }

  /**
   * Retry a failed request with exponential backoff
   */
  public async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Don't retry on validation errors or if it's the last attempt
        if (error instanceof ValidationError || attempt === maxRetries - 1) {
          throw error
        }

        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
          10000 // Max 10 seconds
        )

        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw lastError || new Error('All retry attempts failed')
  }
}
