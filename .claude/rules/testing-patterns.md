---
paths:
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - '**/*.spec.ts'
  - 'vitest.config.*'
---

## Testing Patterns

### Framework

- Vitest + React Testing Library
- Run with `bun run test` (not npx vitest directly)
- Run single file: `bun run test path/to/file.test.ts`

### What to Test

- Server actions: validate input → service call → correct ActionResult returned
- Services: business logic with edge cases (duplicate handling, missing data, race conditions)
- Mappers: pure function correctness — input/output pairs
- Webhook handlers: signature verification, idempotency check, correct event routing

### What NOT to Mock

- Prisma queries in integration tests — use real database transactions that rollback
- Zod schemas — validate with actual input, don't mock `.parse()`

### What to Mock

- Stripe API calls — use `vi.mock()` with realistic response fixtures
- External HTTP calls (Sentry, Axiom) — mock at the transport level
- `revalidatePath` / `revalidateTag` — mock to verify they're called with correct paths

### Mock Data Must Match Runtime Shape

When mocking Prisma records (e.g., `person`), include all fields the code accesses. Common miss: omitting `email` or `phone` on Person mocks causes null access errors.

```typescript
// Bad: missing email/phone — code that reads person.email will get undefined
{ id: 'p-1', name: 'Test Person' }

// Good: include all fields the code accesses
{ id: 'p-1', name: 'Test Person', email: 'test@example.com', phone: '6125551234' }
```

### Test Structure

```typescript
describe('serviceName', () => {
  it('should handle the happy path', async () => {
    // arrange: set up test data
    // act: call the function
    // assert: check result + side effects
  })

  it('should handle P2002 duplicate gracefully', async () => {
    // verify upsert or catch behavior, not crash
  })
})
```
