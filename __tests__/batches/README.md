# Batches Module Tests

This directory contains comprehensive tests for the batches module.

## Overview

The test suite covers:
- Server actions (mutations with validation)
- Database queries (Prisma operations)
- UI state management (Zustand store)
- Client-side filtering utilities
- Component integration (future)

## Test Structure

```
__tests__/batches/
├── actions/
│   └── batch-actions.test.ts      # Server action tests
├── queries/
│   └── batch-queries.test.ts      # Database query tests
├── store/
│   ├── ui-store.test.ts           # Zustand UI store tests
│   └── filter-utils.test.ts       # Client filtering tests
├── components/                     # Future: Component tests
└── README.md                       # This file
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm test __tests__/batches/actions/batch-actions.test.ts
```

### Run Tests in Watch Mode
```bash
npm test:watch
```

### Run Tests with Coverage
```bash
npm test:coverage
```

## Test Coverage Goals

### Current Coverage
- **Server Actions**: ✅ Full coverage
  - Create batch action
  - Update batch action
  - Delete batch action
  - Validation with Zod
  - Duplicate name detection
  - Student count safety checks

- **Database Queries**: ✅ Full coverage
  - CRUD operations for batches
  - Student assignment/transfer
  - Batch filtering
  - Summary statistics
  - Transaction handling

- **UI Store**: ✅ Full coverage
  - Student selection (individual, all, clear)
  - Batch selection
  - Filter management (search, batch, status, education, grade, date)
  - Dialog state management
  - Reset functionality

- **Filter Utilities**: ✅ Full coverage
  - Search filtering (name, email, phone)
  - Batch filtering (with unassigned option)
  - Status, education level, grade level filtering
  - Date range filtering
  - Multiple filter combination
  - Filter summary and counting

### Future Coverage (Not Yet Implemented)
- **Components**: ⏳ Pending
  - Batch card rendering
  - Student table interactions
  - Form validations
  - Dialog behaviors

## Test Dependencies

The tests use the following libraries:
- **Vitest**: Test runner (faster than Jest)
- **@testing-library/jest-dom**: DOM matchers
- **@testing-library/react**: React component testing (for future component tests)

## Mocking Strategy

### Server Actions Tests
- Mock database query functions (`@/lib/db/queries/batch`)
- Mock Next.js cache revalidation (`next/cache`)

### Database Queries Tests
- Mock Prisma client (`@/lib/db`)
- Mock transactions for complex operations

### UI Store Tests
- No mocking needed (pure Zustand state management)
- Tests use actual store implementation

### Filter Utilities Tests
- No mocking needed (pure functions)
- Tests use mock student data

## Writing New Tests

### Test File Template
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks()
  })

  describe('Specific Function', () => {
    it('should do something', () => {
      // Arrange
      const input = 'test'

      // Act
      const result = someFunction(input)

      // Assert
      expect(result).toBe('expected')
    })
  })
})
```

### Best Practices
1. **Arrange-Act-Assert**: Structure tests clearly
2. **Descriptive Names**: Use "should" in test descriptions
3. **Isolation**: Each test should be independent
4. **Mock External Dependencies**: Database, APIs, etc.
5. **Test Edge Cases**: Empty arrays, null values, errors
6. **Test Happy Path First**: Then add error cases

## Common Test Patterns

### Testing Server Actions
```typescript
it('should create batch with valid data', async () => {
  const formData = new FormData()
  formData.append('name', 'Spring 2024')

  vi.mocked(getBatchByName).mockResolvedValue(null)
  vi.mocked(createBatch).mockResolvedValue(mockBatch)

  const result = await createBatchAction(formData)

  expect(result.success).toBe(true)
})
```

### Testing Zustand Store
```typescript
it('should select student', () => {
  const store = useUIStore.getState()

  store.selectStudent('student-1')

  expect(store.isStudentSelected('student-1')).toBe(true)
})
```

### Testing Filter Functions
```typescript
it('should filter students by name', () => {
  const students = [mockStudent1, mockStudent2]
  const filters = { search: { query: 'john', fields: ['name'] } }

  const result = filterStudents(students, filters)

  expect(result).toHaveLength(1)
})
```

## Troubleshooting

### Tests Not Running
1. Check if Vitest is installed: `npm install -D vitest`
2. Verify `vitest.config.ts` exists
3. Check test file naming: `*.test.ts` or `*.spec.ts`

### Mock Not Working
1. Ensure `vi.mock()` is at top level (not inside describe/it)
2. Clear mocks in `beforeEach` hook
3. Use `vi.mocked()` for type-safe mocking

### Import Errors
1. Check path aliases in `vitest.config.ts`
2. Verify `@/` maps to project root
3. Check `tsconfig.json` paths

### Coverage Not Generated
1. Run with coverage flag: `npm test:coverage`
2. Check `coverage/` directory
3. Install coverage provider: `npm install -D @vitest/coverage-v8`

## Test Maintenance

### When to Update Tests
- ✅ When adding new features
- ✅ When fixing bugs (add regression test)
- ✅ When refactoring (ensure tests still pass)
- ⚠️ When changing APIs (update relevant tests)

### Test Smell Checklist
- ❌ Tests depend on execution order
- ❌ Tests modify global state
- ❌ Tests take too long (>1s per test)
- ❌ Tests are flaky (sometimes pass/fail)
- ❌ Tests have too much setup code

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Zustand Testing](https://github.com/pmndrs/zustand#testing)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Contributing

When adding tests:
1. Follow existing patterns
2. Add descriptive test names
3. Test both happy and error paths
4. Update this README if needed
5. Ensure all tests pass before committing

---

**Last Updated**: 2025-01-30
**Test Framework**: Vitest
**Coverage Goal**: 80%+ for critical paths
