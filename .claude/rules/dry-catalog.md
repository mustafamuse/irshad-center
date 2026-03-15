---
paths:
  - 'lib/**'
  - 'app/**/actions.ts'
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

| Service                   | Functions                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `webhook-service.ts`      | `handleSubscriptionCreated()`, `handleSubscriptionUpdated()`, `handleInvoiceFinalized()`, `handleSubscriptionDeleted()` |
| `base-webhook-handler.ts` | `createWebhookHandler()` (factory)                                                                                      |
| `event-handlers.ts`       | `createEventHandlers()`, `mahadEventHandlers`, `dugsiEventHandlers`                                                     |

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

### Mappers, Utilities, Constants, Validations

| Location                             | Key exports                                               |
| ------------------------------------ | --------------------------------------------------------- |
| `lib/mappers/mahad-mapper.ts`        | `mahadEnrollmentInclude`, `extractStudentEmail/Phone()`   |
| `lib/mappers/dugsi-mapper.ts`        | `mapToFamilyDTO()`                                        |
| `lib/utils/action-helpers.ts`        | `ActionResult<T>`, `withActionError()`                    |
| `lib/utils/type-guards.ts`           | `isPrismaError()`, `isStripeError()`, `isValidEmail()`    |
| `lib/utils/contact-normalization.ts` | `normalizePhone()`, `normalizeEmail()`                    |
| `lib/constants/`                     | `MAHAD_PROGRAM`, `DUGSI_PROGRAM`, `STRIPE_WEBHOOK_EVENTS` |
| `lib/validations/`                   | `CreateBatchSchema`, `webhookStudentNameSchema`           |
