import * as React from 'react'

import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
;(global as typeof global & { React: typeof React }).React = React

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
  }
})
