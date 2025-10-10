# Test Setup Instructions

This document explains how to set up and run tests for the Irshad Center application.

## Prerequisites

The following testing dependencies are already installed:
- ✅ `vitest` - Fast test runner
- ✅ `@vitest/ui` - Test UI dashboard
- ✅ `@testing-library/jest-dom` - DOM matchers (if needed for component tests)

## Quick Start

### 1. Run All Tests
```bash
npm test
```

This will run all tests once and exit.

### 2. Run Tests in Watch Mode
```bash
npm test:watch
```

This will watch for file changes and re-run affected tests.

### 3. Run Tests with UI Dashboard
```bash
npm test:ui
```

This opens an interactive UI at `http://localhost:51204` to view and run tests.

### 4. Run Tests with Coverage
```bash
npm test:coverage
```

This generates a coverage report in the `coverage/` directory.

## Installing Missing Dependencies

If you encounter errors about missing dependencies, install them:

```bash
# Core testing dependencies
npm install -D vitest @vitest/ui

# React testing (for component tests)
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event

# Coverage provider (if using coverage)
npm install -D @vitest/coverage-v8

# Additional helpers
npm install -D jsdom happy-dom
```

## Project Structure

```
__tests__/
├── setup.ts                    # Global test setup
├── batches/
│   ├── actions/               # Server action tests
│   ├── queries/               # Database query tests
│   ├── store/                 # State management tests
│   ├── components/            # Component tests (future)
│   └── README.md              # Batches test documentation
└── SETUP.md                   # This file
```

## Configuration Files

- **`vitest.config.ts`** - Main Vitest configuration
- **`__tests__/setup.ts`** - Global test setup (runs before all tests)
- **`tsconfig.json`** - TypeScript configuration (includes path aliases)

## Common Issues

### Issue: "Cannot find module '@/...'"
**Solution**: Check that `vitest.config.ts` has the correct path alias:
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './'),
  },
}
```

### Issue: "vi is not defined"
**Solution**: Add `globals: true` to `vitest.config.ts`:
```typescript
test: {
  globals: true,  // This enables vi, describe, it, expect globally
  // ...
}
```

### Issue: Tests failing due to Next.js modules
**Solution**: Next.js specific modules are already mocked in `__tests__/setup.ts`. If you need to mock additional modules, add them there.

### Issue: Prisma client errors
**Solution**: Prisma is mocked in individual test files. Make sure to:
1. Mock `@/lib/db` at the top of test files
2. Clear mocks in `beforeEach` hooks
3. Set up return values for mocked functions

## Running Specific Tests

### Run tests for a specific file
```bash
npm test __tests__/batches/actions/batch-actions.test.ts
```

### Run tests matching a pattern
```bash
npm test -- --grep "batch"
```

### Run tests in a specific directory
```bash
npm test __tests__/batches/store
```

## Debugging Tests

### Use console.log
```typescript
it('should do something', () => {
  console.log('Debug output:', someValue)
  expect(someValue).toBe(expected)
})
```

### Use Vitest UI
The UI dashboard (`npm test:ui`) provides:
- Interactive test selection
- Detailed error messages
- Test execution timeline
- Code coverage visualization

### Use VS Code Debugger
1. Add a breakpoint in your test
2. Run "Debug Current Test File" from VS Code
3. Or add a debug configuration to `.vscode/launch.json`

## Writing Your First Test

Create a new test file:
```typescript
// __tests__/example.test.ts
import { describe, it, expect } from 'vitest'

describe('Example Test Suite', () => {
  it('should add two numbers', () => {
    const result = 1 + 1
    expect(result).toBe(2)
  })
})
```

Run it:
```bash
npm test __tests__/example.test.ts
```

## Best Practices

1. **Keep tests isolated** - Each test should be independent
2. **Use descriptive names** - Test names should describe what they test
3. **Test behavior, not implementation** - Focus on what, not how
4. **Mock external dependencies** - Database, APIs, file system, etc.
5. **Clean up after tests** - Reset mocks, clear state
6. **Use beforeEach/afterEach** - Set up common test data
7. **Test edge cases** - Empty arrays, null values, errors
8. **Keep tests fast** - Slow tests won't be run

## Coverage Goals

Current coverage for batches module:
- **Server Actions**: 100%
- **Database Queries**: 100%
- **UI Store**: 100%
- **Filter Utilities**: 100%

Overall project goal: **80%+ coverage** for critical paths.

## CI/CD Integration

To run tests in CI/CD:
```bash
# Run tests once (exit with code on failure)
npm test -- --run

# Run tests with coverage
npm test:coverage

# Generate coverage report for CI
npm test:coverage -- --reporter=json --reporter=text
```

## Next Steps

1. ✅ Test infrastructure is set up
2. ✅ Core batches module tests are complete
3. ⏳ Add component tests (when needed)
4. ⏳ Add integration tests (when needed)
5. ⏳ Add E2E tests (when needed)

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Vitest VS Code Extension](https://marketplace.visualstudio.com/items?itemName=ZixuanChen.vitest-explorer)

## Getting Help

If you encounter issues:
1. Check this document
2. Check the [batches test README](__tests__/batches/README.md)
3. Review existing test files for examples
4. Search Vitest documentation

---

**Last Updated**: 2025-01-30
