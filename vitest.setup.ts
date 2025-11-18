// Mock React cache() for Server Components
// This is needed because cache() is a React Server Components API
// that doesn't exist in the client/test environment
import * as React from 'react'

// Make React globally available
// @ts-expect-error - Adding to global for tests
global.React = React

// Try to add cache if it doesn't exist or isn't a function
try {
  if (typeof React.cache !== 'function') {
    Object.defineProperty(React, 'cache', {
      value: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
      writable: true,
      configurable: true,
    })
  }
} catch (e) {
  // cache already exists, which is fine
}
