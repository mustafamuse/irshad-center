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

### Person Contact Rules

Email and phone live directly on `Person` as nullable unique fields.

1. **Always use normalizeEmail()/normalizePhone() before writing** — they return `null` for falsy input, preventing empty strings
2. **Cleared values must be `NULL`, never empty string** — PostgreSQL treats `''` as a real value under unique constraints
3. **Phone is E.164 canonical** (`+1XXXXXXXXXX` for US, `+252XXXXXXXXX` for Somalia, etc.) — `normalizePhone()` normalizes any input to E.164, returns null for invalid
4. **Validate input before opening a transaction** — normalize/validate phones, emails, etc. before `prisma.$transaction()`
5. **Never try-catch P2002 inside `$transaction()`** — PostgreSQL aborts the transaction on constraint violations

### Webhook Handler Factory

```typescript
export const POST = createWebhookHandler({
  source: 'mahad',
  verifyWebhook: verifyMahadWebhook,
  eventHandlers: mahadEventHandlers,
})
```
