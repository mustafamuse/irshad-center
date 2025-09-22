import { ReactNode } from 'react'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Create a custom render function that includes providers
function customRender(ui: ReactNode, { queryClient = new QueryClient() } = {}) {
  return {
    user: userEvent.setup(),
    ...render(ui, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    }),
  }
}

// Mock data generators
export const mockStudent = (overrides = {}) => ({
  id: 'test-id',
  name: 'Test Student',
  email: 'test@example.com',
  rollNumber: '001',
  ...overrides,
})

export const mockBatch = (overrides = {}) => ({
  id: 'test-batch-id',
  name: 'Test Batch',
  ...overrides,
})

export const mockAttendanceSession = (overrides = {}) => ({
  id: 'test-session-id',
  date: new Date().toISOString(),
  batchId: 'test-batch-id',
  batchName: 'Test Batch',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  records: [],
  summary: {
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
  },
  ...overrides,
})

export const mockAttendanceRecord = (overrides = {}) => ({
  id: 'test-record-id',
  sessionId: 'test-session-id',
  studentId: 'test-student-id',
  status: 'PRESENT',
  notes: '',
  ...overrides,
})

// Re-export everything from RTL
export * from '@testing-library/react'
export { customRender as render }
export { userEvent }

// Common test matchers
export const matchers = {
  toHaveLoadingState: () => ({
    compare: (actual: HTMLElement) => {
      const hasLoadingIndicator = actual.querySelector('[role="progressbar"]')
      return {
        pass: !!hasLoadingIndicator,
        message: () =>
          `Expected ${actual} ${
            hasLoadingIndicator ? 'not ' : ''
          }to have loading state`,
      }
    },
  }),
  toHaveErrorState: () => ({
    compare: (actual: HTMLElement) => {
      const hasError = actual.querySelector('[role="alert"]')
      return {
        pass: !!hasError,
        message: () =>
          `Expected ${actual} ${hasError ? 'not ' : ''}to have error state`,
      }
    },
  }),
}
