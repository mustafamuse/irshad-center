# Irshad Center - Architecture Reference

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

### Dugsi Services (`lib/services/dugsi/`)

| Service                               | Functions                                                        |
| ------------------------------------- | ---------------------------------------------------------------- |
| `consolidate-subscription-service.ts` | `previewStripeSubscription()`, `consolidateStripeSubscription()` |
| `registration-service.ts`             | `processRegistration()`, `validateRegistrationData()`            |

### Query Functions (`lib/db/queries/`)

| File            | Functions                                                |
| --------------- | -------------------------------------------------------- |
| `student.ts`    | `getStudents()`, `getStudentById()`, `searchStudents()`  |
| `billing.ts`    | `getBillingAccountByPerson()`, `getBillingAssignments()` |
| `enrollment.ts` | `getEnrollmentsByBatch()`, `getActiveEnrollment()`       |
| `siblings.ts`   | `getSiblingGroups()`, `createSiblingRelationship()`      |

### Mappers (`lib/mappers/`)

| Mapper            | Functions                                                                  |
| ----------------- | -------------------------------------------------------------------------- |
| `mahad-mapper.ts` | `mahadEnrollmentInclude`, `extractStudentEmail()`, `extractStudentPhone()` |
| `dugsi-mapper.ts` | `mapToFamilyDTO()`                                                         |

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
