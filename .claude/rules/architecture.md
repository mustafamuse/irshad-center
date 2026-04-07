---
paths:
  - 'lib/services/**'
  - 'lib/db/**'
  - 'lib/mappers/**'
  - 'app/**/actions.ts'
  - 'app/api/**'
---

## Architecture Patterns

### Service Layer

| Location                 | Purpose                                          |
| ------------------------ | ------------------------------------------------ |
| `lib/services/shared/`   | Cross-program (billing, subscriptions, payments) |
| `lib/services/mahad/`    | Mahad-specific (enrollment, cohort)              |
| `lib/services/dugsi/`    | Dugsi-specific (family, registration)            |
| `lib/services/webhooks/` | Stripe webhook handlers                          |

Rules: Services call query functions (not raw Prisma), are program-agnostic, export result interfaces.

### Query Layer

```typescript
export async function getBillingAccount(
  personId: string,
  client: DatabaseClient = prisma
) {
  return client.billingAccount.findFirst({ where: { personId } })
}
```

### Action Pattern

All actions use next-safe-action v8 clients from `lib/safe-action.ts`:

- `adminActionClient` — admin-only mutations
- `rateLimitedActionClient` — public-facing mutations (rate limited)

```typescript
'use server'
import { after } from 'next/server'
import { adminActionClient } from '@/lib/safe-action'

const _myAction = adminActionClient
  .metadata({ actionName: 'myAction' })
  .schema(mySchema)
  .action(async ({ parsedInput }) => {
    const result = await myService(parsedInput)
    after(() => revalidatePath('/path'))
    return result
  })

export async function myAction(...args: Parameters<typeof _myAction>) {
  return _myAction(...args)
}
```

Errors: throw `ActionError(message, ERROR_CODES.X)` for domain errors — safe-action's `handleServerError` catches and serializes them. Never return `{ success: false }` manually.

### Mapper Pattern

```typescript
// No DB calls, no business logic, pure functions, typed inputs
export function mapEnrollmentToStudent(enrollment: EnrollmentFull): StudentDTO {
  return {
    /* pure transformation */
  }
}
```

### Person Contact Rules

Email and phone live directly on `Person` as nullable unique fields.

1. **Always use normalizeEmail()/normalizePhone() before writing** — they return `null` for falsy input, preventing empty strings
2. **Cleared values must be `NULL`, never empty string** — PostgreSQL treats `''` as a real value under unique constraints
3. **Phone is US-only, 10-digit canonical** — `normalizePhone()` strips formatting and validates
4. **Validate input before opening a transaction** — normalize/validate phones, emails, etc. before `prisma.$transaction()`
5. **Never try-catch P2002 inside `$transaction()`** — PostgreSQL aborts the transaction on constraint violations

### Returnee Contact Policy

When a person re-registers or returns after absence:

- **Registration flows** (self-service): Conservative merge — fill null fields only, never overwrite existing email/phone
- **Admin update flows** (dashboard): Unconditional overwrite — admin has authority to correct data
- Both paths normalize via `normalizeEmail()`/`normalizePhone()` before writing

### Webhook Handler Factory

```typescript
export const POST = createWebhookHandler({
  source: 'mahad',
  verifyWebhook: verifyMahadWebhook,
  eventHandlers: mahadEventHandlers,
})
```
