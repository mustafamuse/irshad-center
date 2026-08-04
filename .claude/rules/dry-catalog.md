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
| `unified-matcher.ts`      | `matchPersonToSubscription()`                                    |

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

| File                 | Functions                                                |
| -------------------- | -------------------------------------------------------- |
| `student.ts`         | `getStudents()`, `getStudentById()`, `searchStudents()`  |
| `program-profile.ts` | `findPersonByActiveContact()`, `getProgramProfiles()`    |
| `billing.ts`         | `getBillingAccountByPerson()`, `getBillingAssignments()` |
| `enrollment.ts`      | `getEnrollmentsByBatch()`, `getActiveEnrollment()`       |
| `siblings.ts`        | `getSiblingGroups()`, `createSiblingRelationship()`      |

**Rule**: Services must use these query functions. Never call `prisma.X.Y()` directly from `lib/services/`. A 2026-08-04 audit found 17 violating service files (~85 raw calls); the migration is Phase 4 of `docs/superpowers/specs/2026-08-04-actions-refactor-design.md` — do not add new violations meanwhile.

### Admin Action Files (post-2026-08 split — add new actions to the matching domain file)

| Directory                   | Files                                                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `app/admin/dugsi/actions/`  | `read-actions.ts`, `class-actions.ts`, `family-actions.ts`, `payment-actions.ts`, `subscription-actions.ts`, `billing-actions.ts` |
| `app/admin/dugsi/`          | `teachers/actions.ts` (single-domain), `withdrawal-actions.ts`                                                                    |
| `app/admin/mahad/_actions/` | `batch-actions.ts`, `student-actions.ts`, `payment-actions.ts`, `vcard-actions.ts`                                                |

Never recreate a monolithic `actions.ts` / `_actions/index.ts` in these directories.

### Revalidation targets (canonical)

- Revalidate only routes that exist AND render the mutated data. `/admin/teachers`, `/admin/attendance`, `/admin/payments`, `/admin/shared/attendance` are `permanentRedirect` stubs — revalidating them does nothing; target the real route (e.g. `/admin/dugsi/teachers`).
- Cache tags with real `unstable_cache` consumers: `dugsi-registrations` (/admin/dugsi), `mahad-students` (/admin/mahad), `mahad-stats` (/admin/mahad/payments), `link-subscriptions`, `donations`. A `revalidateTag` with any other string is a no-op.
- All revalidation goes inside `after()` (rule 19).

### Mappers, Utilities, Constants, Validations

| Location                             | Key exports                                               |
| ------------------------------------ | --------------------------------------------------------- |
| `lib/mappers/mahad-mapper.ts`        | `mahadEnrollmentInclude`                                  |
| `lib/mappers/dugsi-mapper.ts`        | `mapToFamilyDTO()`                                        |
| `lib/safe-action.ts`                 | next-safe-action base client (auth, rate limit)           |
| `lib/types/batch.ts`                 | `ActionResult<T>`                                         |
| `lib/utils/type-guards.ts`           | `isPrismaError()`, `isStripeError()`, `isValidEmail()`    |
| `lib/utils/contact-normalization.ts` | `normalizePhone()`, `normalizeEmail()`                    |
| `lib/constants/`                     | `MAHAD_PROGRAM`, `DUGSI_PROGRAM`, `STRIPE_WEBHOOK_EVENTS` |
| `lib/validations/`                   | `CreateBatchSchema`, `webhookStudentNameSchema`           |
