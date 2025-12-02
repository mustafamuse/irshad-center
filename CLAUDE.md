# Irshad Center - Claude Code Rules

## Stack

- Next.js 15.3.0 (App Router, Server Components)
- Prisma 6.16.2 + PostgreSQL
- TypeScript 5.9.0 (strict mode)
- Stripe (dual accounts: Mahad + Dugsi)
- Vitest + React Testing Library
- Pino logging + Sentry error tracking
- shadcn/ui + Tailwind CSS
- Zod + react-hook-form
- Zustand state management

---

## Critical Rules (Strict Enforcement)

Claude should refuse to write code violating these rules.

### Server Components First (Next.js App Router)

1. **Default to Server Components** - All components are Server Components by default. Only add `'use client'` when required (interactivity, hooks, browser APIs).

2. **Use Server Actions for mutations** - Prefer server actions over API routes for data mutations.

   ```typescript
   // PREFERRED
   'use server'
   export async function createStudent(data: Input) { ... }

   // AVOID
   const res = await fetch('/api/students', { method: 'POST' })
   ```

3. **Minimize client components** - Extract interactive parts into small client components. Keep data fetching in server components.

### Database Safety

4. **Never reset production database** - Forbidden: `prisma migrate reset`, `DROP TABLE`, `TRUNCATE`. Check `DATABASE_URL` doesn't contain "prod" before destructive ops.

5. **Use transactions for multi-table operations**

   ```typescript
   await prisma.$transaction(async (tx) => {
     const person = await tx.person.create({ data })
     const profile = await tx.programProfile.create({
       data: { personId: person.id },
     })
   })
   ```

6. **Handle P2002 race conditions** - Use upsert pattern or catch P2002 errors. Never check-then-create without transaction.

### Type Safety

7. **Never use `any` type**

   ```typescript
   // FORBIDDEN
   function process(data: any) { ... }

   // REQUIRED
   function process(data: StudentInput) { ... }
   ```

8. **Validate ALL external input with Zod** - Required before database operations.

   ```typescript
   const validated = schema.parse(input)
   await prisma.person.create({ data: validated })
   ```

9. **Use Prisma enums from generated types**
   ```typescript
   import { Program, EnrollmentStatus } from '@prisma/client'
   ```

### Stripe/Webhook Safety

10. **Always verify webhook signatures** - Never process webhooks without `constructEvent()`. Use program-specific secrets (DEV vs PROD).

11. **Implement webhook idempotency** - Check `WebhookEvent` table before processing. Record event ID immediately.

12. **Use correct Stripe client per program**

    ```typescript
    // Mahad: import { stripeServerClient } from '@/lib/stripe'
    // Dugsi: import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
    ```

13. **Validate billing amounts before assignment** - Never create BillingAssignment with amount <= 0.

### Error Handling

14. **Use ActionError with error codes**

    ```typescript
    throw new ActionError('Message', ERROR_CODES.NOT_FOUND, undefined, 404)
    ```

15. **Log errors with structured context**

    ```typescript
    await logError(logger, error, 'Context message', { entityId })
    ```

16. **Never log sensitive data** - Pino redacts: passwords, tokens, card numbers, API keys. Safe to log: emails, phones.

### Server Actions

17. **Always return ActionResult<T>**

    ```typescript
    return { success: true, data } | { success: false, error }
    ```

18. **Revalidate cache after mutations**
    ```typescript
    revalidatePath('/admin/dugsi')
    ```

---

## Architecture Patterns

### Service Layer Organization

| Location                 | Purpose                                          |
| ------------------------ | ------------------------------------------------ |
| `lib/services/shared/`   | Cross-program (billing, subscriptions, payments) |
| `lib/services/mahad/`    | Mahad-specific (enrollment, cohort)              |
| `lib/services/dugsi/`    | Dugsi-specific (family, registration)            |
| `lib/services/webhooks/` | Stripe webhook handlers                          |

Rules:

- Services call query functions, not raw Prisma
- Services are program-agnostic (accept accountType parameter)
- Export result interfaces

### Query Layer Pattern

```typescript
// lib/db/queries/billing.ts
export async function getBillingAccount(
  personId: string,
  client: DatabaseClient = prisma // Required parameter for transaction support
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
// lib/mappers/mahad-mapper.ts
// Rules: No DB calls, no business logic, pure functions, typed inputs
export function mapEnrollmentToStudent(enrollment: EnrollmentFull): StudentDTO {
  return {
    /* pure transformation */
  }
}
```

### Webhook Handler Factory

```typescript
export const POST = createWebhookHandler({
  source: 'mahad',
  verifyWebhook: verifyMahadWebhook,
  eventHandlers: mahadEventHandlers,
})
```

---

## DRY Catalog (Check Before Writing New Code)

### Shared Services (`lib/services/shared/`)

| Service                   | Functions                                                        |
| ------------------------- | ---------------------------------------------------------------- |
| `billing-service.ts`      | `createOrUpdateBillingAccount()`, `linkSubscriptionToProfiles()` |
| `subscription-service.ts` | `createSubscriptionFromStripe()`, `updateSubscriptionStatus()`   |
| `payment-service.ts`      | `recordPayment()`, `getPaymentHistory()`                         |
| `enrollment-service.ts`   | `createEnrollment()`, `updateEnrollmentStatus()`                 |
| `parent-service.ts`       | `createOrUpdateParent()`, `linkParentToChild()`                  |
| `unified-matcher.ts`      | `findPersonByContact()`, `matchPersonToSubscription()`           |

### Webhook Services (`lib/services/webhooks/`)

| Service                   | Functions                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `webhook-service.ts`      | `handleSubscriptionCreated()`, `handleInvoiceFinalized()`, `handleSubscriptionDeleted()` |
| `base-webhook-handler.ts` | `createWebhookHandler()` (factory)                                                       |
| `event-handlers.ts`       | `createEventHandlers()`, `mahadEventHandlers`, `dugsiEventHandlers`                      |

### Query Functions (`lib/db/queries/`)

| File            | Functions                                                |
| --------------- | -------------------------------------------------------- |
| `student.ts`    | `getStudents()`, `getStudentById()`, `searchStudents()`  |
| `billing.ts`    | `getBillingAccountByPerson()`, `getBillingAssignments()` |
| `enrollment.ts` | `getEnrollmentsByBatch()`, `getActiveEnrollment()`       |
| `siblings.ts`   | `getSiblingGroups()`, `createSiblingRelationship()`      |

### Mappers (`lib/mappers/`)

| Mapper            | Functions                                                 |
| ----------------- | --------------------------------------------------------- |
| `mahad-mapper.ts` | `mapEnrollmentToMahadStudent()`, `mahadEnrollmentInclude` |
| `dugsi-mapper.ts` | `mapToFamilyDTO()`                                        |

### Utilities (`lib/utils/`)

| File                       | Functions                                              |
| -------------------------- | ------------------------------------------------------ |
| `action-helpers.ts`        | `ActionResult<T>`, `withActionError()`                 |
| `type-guards.ts`           | `isPrismaError()`, `isStripeError()`, `isValidEmail()` |
| `contact-normalization.ts` | `normalizePhone()`, `normalizeEmail()`                 |

### Constants (`lib/constants/`)

| File        | Constants                                       |
| ----------- | ----------------------------------------------- |
| `mahad.ts`  | `MAHAD_PROGRAM`, `DEFAULT_MONTHLY_RATE`         |
| `dugsi.ts`  | `DUGSI_PROGRAM`                                 |
| `stripe.ts` | `STRIPE_WEBHOOK_EVENTS`, `STRIPE_CUSTOM_FIELDS` |

### Validation Schemas (`lib/validations/`)

| File         | Schemas                                          |
| ------------ | ------------------------------------------------ |
| `batch.ts`   | `CreateBatchSchema`, `UpdateBatchSchema`         |
| `webhook.ts` | `webhookStudentNameSchema`, `webhookPhoneSchema` |

---

## File Organization

```
app/
├── api/webhook/           # Stripe webhooks (use createWebhookHandler)
├── admin/*/actions.ts     # Server actions (ActionResult pattern)
├── admin/*/_components/   # Feature components
lib/
├── services/              # Business logic (NO raw Prisma)
├── db/queries/            # Database queries (accept DatabaseClient)
├── mappers/               # Pure transformation functions
├── validations/           # Zod schemas
├── constants/             # Program/domain constants
├── utils/                 # Helper functions
├── errors/                # Error types (ActionError)
├── logger.ts              # Pino logger factory
components/ui/             # shadcn/ui primitives
```

---

## Import Order

```typescript
'use server'

// 1. Next.js
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

// 2. External packages
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'

// 3. Internal (use @/ prefix)
import { prisma } from '@/lib/db'
import { createActionLogger } from '@/lib/logger'

// 4. Relative
import { localHelper } from './utils'
```

---

## Opus 4.5 Best Practices

### Over-Engineering Prevention

<coding_guidelines>

- Only make changes that are directly requested or clearly necessary. Keep solutions simple and focused.
- Don't add features, refactor code, or make "improvements" beyond what was asked.
- Don't add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code and framework guarantees. Only validate at system boundaries.
- Don't create helpers, utilities, or abstractions for one-time operations.
- The right amount of complexity is the minimum needed for the current task.
- Reuse existing abstractions where possible and follow the DRY principle.
  </coding_guidelines>

### Code Exploration

<code_exploration>
Read and understand relevant files before proposing code edits. Do not speculate about code you have not inspected.

If the user references a specific file/path, open and inspect it before explaining or proposing fixes.

Be rigorous and persistent in searching code for key facts. Thoroughly review the style, conventions, and abstractions of the codebase before implementing new features.
</code_exploration>

### Code Style

<code_style>

- Do minimal required changes while still delivering the goal
- Do not put comments into the code unless explaining complex business logic - code should be self-descriptive
- Do not use emojis in code or file names
- Be straightforward and sharp in implementations
- Avoid backwards-compatibility hacks like renaming unused `_vars`, re-exporting types, or adding `// removed` comments. If something is unused, delete it completely.
  </code_style>
