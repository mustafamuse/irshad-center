/**
 * Test Setup Configuration
 *
 * Global test setup for Vitest/Jest.
 * This file is executed once before all test suites.
 */

// Extend global test configuration
global.console = {
  ...console,
  // Suppress console errors in tests (optional)
  error: vi.fn(),
  warn: vi.fn(),
}

// Mock Next.js specific modules that might cause issues in tests
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    pathname: '/',
    query: {},
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

// Reset all mocks after each test
afterEach(() => {
  vi.clearAllMocks()
})
