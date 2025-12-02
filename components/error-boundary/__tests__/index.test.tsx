import * as Sentry from '@sentry/nextjs'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

import { AppErrorBoundary } from '../index'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

function ThrowError({ message }: { message: string }): never {
  throw new Error(message)
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders children when no error', () => {
    render(
      <AppErrorBoundary>
        <div>Test content</div>
      </AppErrorBoundary>
    )
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('renders inline variant for caught errors', () => {
    render(
      <AppErrorBoundary variant="inline">
        <ThrowError message="Test error" />
      </AppErrorBoundary>
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('renders card variant by default', () => {
    render(
      <AppErrorBoundary>
        <ThrowError message="Test error" />
      </AppErrorBoundary>
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('detects database errors correctly', () => {
    render(
      <AppErrorBoundary variant="card">
        <ThrowError message="database connection failed" />
      </AppErrorBoundary>
    )
    expect(screen.getByText('Database Connection Error')).toBeInTheDocument()
  })

  it('detects not found errors correctly', () => {
    render(
      <AppErrorBoundary variant="card">
        <ThrowError message="Resource not found" />
      </AppErrorBoundary>
    )
    expect(screen.getByText('Not Found')).toBeInTheDocument()
  })

  it('calls Sentry.captureException on error', () => {
    render(
      <AppErrorBoundary context="test-context" variant="card">
        <ThrowError message="Test error" />
      </AppErrorBoundary>
    )
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { errorBoundary: 'test-context', variant: 'card' },
    })
  })

  it('respects custom onReset handler', () => {
    const customReset = vi.fn()
    render(
      <AppErrorBoundary onReset={customReset} variant="inline">
        <ThrowError message="Test error" />
      </AppErrorBoundary>
    )
    fireEvent.click(screen.getByText('Try again'))
    expect(customReset).toHaveBeenCalled()
  })

  it('uses custom fallbackUrl and fallbackLabel', () => {
    render(
      <AppErrorBoundary
        variant="card"
        fallbackUrl="/dashboard"
        fallbackLabel="Back to Dashboard"
      >
        <ThrowError message="Test error" />
      </AppErrorBoundary>
    )
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument()
  })
})
