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

```typescript
'use server'
export async function myAction(input: Input): Promise<ActionResult<Output>> {
  try {
    const validated = schema.parse(input)
    const result = await service(validated)
    revalidatePath('/path')
    return { success: true, data: result }
  } catch (error) {
    await logError(logger, error, 'Action failed')
    return { success: false, error: 'User-friendly message' }
  }
}
```

### Mapper Pattern

```typescript
// No DB calls, no business logic, pure functions, typed inputs
export function mapEnrollmentToStudent(enrollment: EnrollmentFull): StudentDTO {
  return {
    /* pure transformation */
  }
}
```

### ContactPoint Rules

When working with `contactPoint` records, follow these rules to avoid data bugs:

1. **Always set `isPrimary: true`** on `contactPoint.create` — all contact types get `isPrimary: true`
2. **Always filter `isActive: true`** when looking up existing contact points — never match soft-deleted records
3. **Never try-catch P2002 inside `$transaction()`** — PostgreSQL aborts the transaction on constraint violations; any `tx` operations in the catch block are dead code. Use read-first pattern: `tx.contactPoint.findFirst` before `create` to decide update vs create
4. **Validate input before opening a transaction** — normalize/validate phones, emails, etc. before `prisma.$transaction()` to avoid wasting DB connections on invalid input

### Webhook Handler Factory

```typescript
export const POST = createWebhookHandler({
  source: 'mahad',
  verifyWebhook: verifyMahadWebhook,
  eventHandlers: mahadEventHandlers,
})
```
