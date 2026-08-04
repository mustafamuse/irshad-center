# Split Action Monoliths (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `app/admin/dugsi/actions.ts` (1590 lines, 36 actions) and `app/admin/mahad/_actions/index.ts` (1010 lines, 11 actions) into single-domain files with zero behavior change.

**Architecture:** Pure verbatim moves. Every private action def moves together with its exported wrapper, its schemas, and any helpers only it uses. Both monoliths are deleted; all import sites update to the new domain files (no re-export barrels — `tsc` catches every miss). Every new file starts with `'use server'` and recreates the module-level logger with the SAME logger name string (load-bearing for Axiom queries).

**Tech Stack:** Next.js 15 server actions, next-safe-action v8, Vitest.

## Global Constraints

- Zero behavior change: no logic edits, no signature changes, no renamed exports, no deleted exports (even currently-unused ones move along).
- The private-def + exported-async-wrapper pattern moves verbatim; in new files place each wrapper immediately after its private def.
- Logger name strings preserved exactly: dugsi files use `createServiceLogger('dugsi-admin-actions')`, the mahad payment file uses `createActionLogger('mahad')`.
- `git diff` should show only: new files whose content is relocated code, deletions of the two monoliths, and import-path updates in consumers.
- Verification per task: `bunx tsc --noEmit` clean + the named test files pass. Full suite + lint in the final task.
- Run tests with `bun run test <path>`.

## Reference

The complete structural map (every declaration with line numbers, per-action domain classification, every importer with exact specifiers) is at the end of this plan under **Appendix: Structural Map**. Implementers MUST follow the assignment tables below; the appendix line numbers locate each piece in the source.

---

### Task 1: Split `app/admin/dugsi/actions.ts` into five domain files

**Files:**

- Create: `app/admin/dugsi/actions/read-actions.ts`, `app/admin/dugsi/actions/class-actions.ts`, `app/admin/dugsi/actions/family-actions.ts`, `app/admin/dugsi/actions/payment-actions.ts`, `app/admin/dugsi/actions/subscription-actions.ts`
- Delete: `app/admin/dugsi/actions.ts`
- Modify (import paths only): the 21 consumer files listed in Step 3
- Test (existing, must pass unchanged except its import line): `app/admin/dugsi/__tests__/vcard-action.test.ts`

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces: five modules whose exported names are IDENTICAL to the old module's exports (Task 3 verifies globally). No export is renamed or dropped.

**Action → file assignment (complete, all 36):**

| New file                  | Actions (exported wrapper names)                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `read-actions.ts`         | `getDugsiRegistrations`, `generateDugsiVCardContent`                                                                                                                                                                                                                                                                                                                                                                            |
| `class-actions.ts`        | `getAvailableDugsiTeachers`, `getUnassignedStudentsAction`, `getClassesWithDetailsAction`, `getAllTeachersForClassAssignmentAction`, `getAvailableStudentsForClassAction`, `getClassDeletePreviewAction`, `assignTeacherToClassAction`, `removeTeacherFromClassAction`, `enrollStudentInClassAction`, `removeStudentFromClassAction`, `bulkEnrollStudentsAction`, `createClassAction`, `updateClassAction`, `deleteClassAction` |
| `family-actions.ts`       | `getFamilyMembers`, `getDeleteFamilyPreview`, `deleteDugsiFamily`, `updateParentInfo`, `addSecondParent`, `setPrimaryPayer`, `updateChildInfo`, `updateFamilyShift`, `addChildToFamily`, `reEnrollChild`, `recalculateFamilyRate`                                                                                                                                                                                               |
| `payment-actions.ts`      | `getDugsiPaymentStatus`, `getFamilyPaymentHistory`, `verifyDugsiBankAccount`, `generateFamilyPaymentLinkAction`, `bulkGeneratePaymentLinksAction`, `sendPaymentLinkViaWhatsAppAction`                                                                                                                                                                                                                                           |
| `subscription-actions.ts` | `validateDugsiSubscription`, `linkDugsiSubscription`, `previewStripeSubscriptionForConsolidation`, `consolidateDugsiSubscription`                                                                                                                                                                                                                                                                                               |

Decisions locked in: `recalculateFamilyRate` goes to family (family-scoped input schema; keeps the three `rateLimitedAdminActionClient` actions together). `getAvailableDugsiTeachers` goes to class (zero importers, used beside class assignment). Do NOT touch the existing `actions/billing-actions.ts`.

**Non-action pieces (complete placement):**

| Piece (source lines in appendix)                                                                                                                                                  | Destination                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `fillVCardName` helper                                                                                                                                                            | read-actions.ts                                                                                |
| `ShiftFilterSchema`                                                                                                                                                               | read-actions.ts                                                                                |
| `StudentIdSchema`                                                                                                                                                                 | family-actions.ts                                                                              |
| `SubscriptionIdSchema`                                                                                                                                                            | subscription-actions.ts                                                                        |
| `ParentEmailSchema`, `VerifyBankSchema`, `GenerateFamilyPaymentLinkSchema`, `BulkPaymentLinksSchema`, `PaymentHistorySchema`, `SendPaymentLinkViaWhatsAppSchema`                  | payment-actions.ts                                                                             |
| `ClassIdSchema` + the 8 imported class schemas re-import                                                                                                                          | class-actions.ts                                                                               |
| `LinkSubscriptionSchema`                                                                                                                                                          | subscription-actions.ts                                                                        |
| `UpdateParentInfoSchema`, `AddSecondParentSchema`, `SetPrimaryPayerSchema`, `UpdateChildInfoSchema`, `AddChildToFamilySchema`                                                     | family-actions.ts                                                                              |
| `export type SendPaymentLinkViaWhatsAppInput`, `export interface GenerateFamilyPaymentLinkInput`, `export interface FamilyPaymentLinkData`, `export interface WhatsAppSendResult` | payment-actions.ts (all four stay exported — `FamilyPaymentLinkData` has an external importer) |
| `const logger = createServiceLogger('dugsi-admin-actions')`                                                                                                                       | recreated in EACH of the five files, same name string                                          |

Each new file carries only the imports its actions need (the appendix maps every import specifier to its referencing actions). `tsc` + eslint (unused-imports) will flag leftovers.

- [ ] **Step 1: Create the five files and move the code**

For each new file: start with `'use server'`, copy the needed imports from the old file's lines 3–116 (adjusting relative paths: the new files sit one directory deeper, so `./_types` becomes `../_types`, `./_schemas/dialog-schemas` becomes `../_schemas/dialog-schemas`, `./_utils/family` becomes `../_utils/family`), the logger line, then each private def followed immediately by its exported wrapper, verbatim. Section-header comments from the old file may be dropped (they describe the monolith's layout, not the new files').

- [ ] **Step 2: Delete the monolith**

```bash
git rm app/admin/dugsi/actions.ts
```

- [ ] **Step 3: Update the 21 import sites**

Exact mapping (all specifiers per file are in the appendix; new path shown relative to each importer):

| Importer                                                                                                                                                                                                                                                               | New source module(s)                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `classes/page.tsx`, `classes/_components/class-management.tsx`, `classes/_components/student-enrollment-dialog.tsx`, `classes/_components/delete-class-dialog.tsx`, `classes/_components/class-form-dialog.tsx`, `classes/_components/unassigned-students-section.tsx` | `../actions/class-actions` or `../../actions/class-actions` (match each file's old relative depth)                                                                                       |
| `components/payment-status-section.tsx`, `components/dialogs/verify-bank-dialog.tsx`, `components/dialogs/payment-link-dialog.tsx` (incl. `type FamilyPaymentLinkData`), `components/family-table/bulk-actions-bar.tsx`                                                | `../../actions/payment-actions` (depth-adjusted)                                                                                                                                         |
| `components/dashboard/dashboard-header.tsx`                                                                                                                                                                                                                            | `../../actions/read-actions`                                                                                                                                                             |
| `components/dialogs/edit-parent-dialog.tsx`, `edit-child-dialog.tsx`, `add-child-dialog.tsx`, `delete-family-dialog.tsx`, `components/family-management/family-detail-sheet.tsx`, `family-management/detail-tabs/overview-tab.tsx`                                     | `.../actions/family-actions`                                                                                                                                                             |
| `components/dialogs/consolidate-subscription-dialog.tsx`, `components/dialogs/link-subscription-dialog.tsx`                                                                                                                                                            | `.../actions/subscription-actions`                                                                                                                                                       |
| `family-management/detail-tabs/billing-tab.tsx`                                                                                                                                                                                                                        | `getFamilyPaymentHistory` from `.../actions/payment-actions`; `recalculateFamilyRate` from `.../actions/family-actions` (its existing `.../actions/billing-actions` import is untouched) |
| `__tests__/vcard-action.test.ts`                                                                                                                                                                                                                                       | `generateDugsiVCardContent` from `../actions/read-actions`                                                                                                                               |

- [ ] **Step 4: Verify**

Run: `bunx tsc --noEmit && bun run test app/admin/dugsi`
Expected: typecheck clean (proves no dangling import anywhere in the repo); dugsi tests pass, including vcard-action.test.ts.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(dugsi): split admin actions monolith into domain files"
```

---

### Task 2: Split `app/admin/mahad/_actions/index.ts` into three domain files

**Files:**

- Create: `app/admin/mahad/_actions/batch-actions.ts`, `app/admin/mahad/_actions/student-actions.ts`, `app/admin/mahad/_actions/payment-actions.ts`
- Delete: `app/admin/mahad/_actions/index.ts`
- Modify (import paths only): 6 component files + 1 test file (Step 3)
- Test (existing, must pass with only its import block updated): `app/admin/mahad/_actions/__tests__/actions.test.ts`

**Interfaces:**

- Consumes: nothing from Task 1.
- Produces: three modules with identical exported names. `vcard-actions.ts` (existing sibling) is untouched.

**Action → file assignment (complete, all 11):**

| New file             | Actions                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `batch-actions.ts`   | `createBatchAction`, `deleteBatchAction`, `updateBatchAction`, `assignStudentsAction`, `transferStudentsAction`                       |
| `student-actions.ts` | `resolveDuplicatesAction`, `getStudentDeleteWarningsAction`, `deleteStudentAction`, `bulkDeleteStudentsAction`, `updateStudentAction` |
| `payment-actions.ts` | `generatePaymentLinkWithOverrideAction`                                                                                               |

Decisions locked in: the two enrollment actions (`assignStudents`, `transferStudents`) live with batch (they operate on batches). `resolveDuplicatesAction` lives with student CRUD. Deletion of index.ts, not a barrel — the directory-specifier imports (`'../../_actions'`) MUST become explicit file paths, matching the existing `vcard-actions.ts` convention.

**Non-action pieces (complete placement):**

| Piece                                                                                                                                                                                                                                | Destination        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| `createBatchInputSchema`, `deleteBatchInputSchema`, `updateBatchInputSchema`, module-private types `AssignmentResult`, `TransferResult`                                                                                              | batch-actions.ts   |
| `updateStudentInputSchema`, `resolveDuplicatesInputSchema`, `studentIdInputSchema`, `bulkDeleteInputSchema`                                                                                                                          | student-actions.ts |
| `paymentLinkWithOverrideInputSchema`, `export interface GeneratePaymentLinkInput`, `export interface PaymentLinkWithOverrideData` (both stay exported), helper `isStaleStripeCustomer`, `const logger = createActionLogger('mahad')` | payment-actions.ts |

Per the appendix, the payment bucket is fully self-contained (logger, `logError`, `featureFlags`, all Stripe/tuition imports are payment-only). batch-actions and student-actions carry NO logger (no action in those buckets logs). `isPrismaError` is needed by both batch (3 uses) and student (`resolveDuplicates`, 1 use) — it is imported from `@/lib/utils/type-guards` in each file that needs it (import duplication is fine; helper duplication would not be, and there is none).

- [ ] **Step 1: Create the three files and move the code**

Same mechanics as Task 1: `'use server'` first, needed imports (paths unchanged — same directory depth as index.ts), then each private def followed by its wrapper, verbatim.

- [ ] **Step 2: Delete the monolith**

```bash
git rm app/admin/mahad/_actions/index.ts
```

- [ ] **Step 3: Update the 7 import sites**

| Importer                                           | Change                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/students/student-details-content.tsx`  | `updateStudentAction` from `'../../_actions/student-actions'`                                                                                                                  |
| `components/dialogs/delete-student-dialog.tsx`     | `deleteStudentAction`, `getStudentDeleteWarningsAction` from `'../../_actions/student-actions'`                                                                                |
| `components/dialogs/resolve-duplicates-dialog.tsx` | `resolveDuplicatesAction` from `'../../_actions/student-actions'`                                                                                                              |
| `components/dialogs/assign-students-dialog.tsx`    | `assignStudentsAction` from `'../../_actions/batch-actions'`                                                                                                                   |
| `components/dialogs/batch-form-dialog.tsx`         | `createBatchAction`, `updateBatchAction` from `'../../_actions/batch-actions'`                                                                                                 |
| `components/dialogs/payment-link-dialog.tsx`       | `generatePaymentLinkWithOverrideAction` from `'../../_actions/payment-actions'`                                                                                                |
| `_actions/__tests__/actions.test.ts`               | split its single `'../index'` import block into three imports from `'../batch-actions'`, `'../student-actions'`, `'../payment-actions'` (same specifiers, no other test edits) |

- [ ] **Step 4: Verify**

Run: `bunx tsc --noEmit && bun run test app/admin/mahad`
Expected: typecheck clean; all mahad tests pass — actions.test.ts's dependency mocks (`@/lib/safe-action`, `@/lib/db`, `@/lib/logger`, etc.) are module-path mocks unaffected by the split.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(mahad): split admin actions monolith into domain files"
```

---

### Task 3: Full verification

**Files:** none created; fixes only if verification fails.

- [ ] **Step 1: Global gate**

```bash
bunx tsc --noEmit && bun run lint && bun run test
```

Expected: all clean/green (lint passes on main as of PR 251 — any new error here was introduced by this branch and must be fixed).

- [ ] **Step 2: Move-purity audit**

```bash
git diff main --stat
```

Confirm: only the 8 new files, 2 deletions, and import-line changes in the 28 consumer/test files. If any consumer diff shows more than import-path changes, revert the extra edits.

- [ ] **Step 3: Commit (only if fixes were needed)**

```bash
git add -A
git commit -m "refactor: verification fixes for action monolith split"
```

---

## Appendix: Structural Map

(Verbatim findings from the 2026-08-04 structural mapping of both files on main at 06315880. Line numbers refer to the pre-split monoliths.)

### Dugsi `app/admin/dugsi/actions.ts` — private defs and wrappers

| Private def (lines)                                    | Client                       | Exported wrapper (lines)                              |
| ------------------------------------------------------ | ---------------------------- | ----------------------------------------------------- |
| `_getDugsiRegistrations` 270–275                       | admin                        | `getDugsiRegistrations` 1406–1410                     |
| `_generateDugsiVCardContent` 277–508                   | admin                        | `generateDugsiVCardContent` 1411–1415                 |
| `_getAvailableDugsiTeachers` 510–529                   | admin                        | `getAvailableDugsiTeachers` 1416–1420                 |
| `_getUnassignedStudentsAction` 531–535                 | admin                        | `getUnassignedStudentsAction` 1421–1425               |
| `_getClassesWithDetailsAction` 537–554                 | admin                        | `getClassesWithDetailsAction` 1426–1430               |
| `_getAllTeachersForClassAssignmentAction` 556–560      | admin                        | `getAllTeachersForClassAssignmentAction` 1431–1435    |
| `_getFamilyMembers` 566–571                            | admin                        | `getFamilyMembers` 1436–1440                          |
| `_getDeleteFamilyPreview` 573–585                      | admin                        | `getDeleteFamilyPreview` 1441–1445                    |
| `_validateDugsiSubscription` 587–592                   | admin                        | `validateDugsiSubscription` 1446–1450                 |
| `_getDugsiPaymentStatus` 594–599                       | admin                        | `getDugsiPaymentStatus` 1451–1455                     |
| `_getFamilyPaymentHistory` 601–630                     | admin                        | `getFamilyPaymentHistory` 1456–1460                   |
| `_getAvailableStudentsForClassAction` 632–637          | admin                        | `getAvailableStudentsForClassAction` 1461–1465        |
| `_getClassDeletePreviewAction` 639–657                 | admin                        | `getClassDeletePreviewAction` 1466–1470               |
| `_deleteDugsiFamily` 663–701                           | admin                        | `deleteDugsiFamily` 1471–1475                         |
| `_linkDugsiSubscription` 703–739                       | admin                        | `linkDugsiSubscription` 1476–1480                     |
| `_verifyDugsiBankAccount` 741–798                      | admin                        | `verifyDugsiBankAccount` 1481–1485                    |
| `_updateParentInfo` 800–815                            | admin                        | `updateParentInfo` 1486–1490                          |
| `_addSecondParent` 817–832                             | admin                        | `addSecondParent` 1491–1495                           |
| `_setPrimaryPayer` 834–849                             | admin                        | `setPrimaryPayer` 1496–1500                           |
| `_updateChildInfo` 851–861                             | admin                        | `updateChildInfo` 1501–1505                           |
| `_updateFamilyShift` 863–876                           | admin                        | `updateFamilyShift` 1506–1510                         |
| `_addChildToFamily` 878–890                            | rateLimited (maxAttempts 10) | `addChildToFamily` 1511–1515                          |
| `_reEnrollChild` 892–915                               | rateLimited (maxAttempts 10) | `reEnrollChild` 1516–1520                             |
| `_recalculateFamilyRate` 917–942                       | rateLimited (maxAttempts 30) | `recalculateFamilyRate` 1521–1525                     |
| `_generateFamilyPaymentLinkAction` 944–973             | admin                        | `generateFamilyPaymentLinkAction` 1526–1530           |
| `_bulkGeneratePaymentLinksAction` 975–1057             | admin                        | `bulkGeneratePaymentLinksAction` 1531–1535            |
| `_assignTeacherToClassAction` 1063–1101                | admin                        | `assignTeacherToClassAction` 1536–1540                |
| `_removeTeacherFromClassAction` 1103–1115              | admin                        | `removeTeacherFromClassAction` 1541–1545              |
| `_enrollStudentInClassAction` 1117–1143                | admin                        | `enrollStudentInClassAction` 1546–1550                |
| `_removeStudentFromClassAction` 1145–1156              | admin                        | `removeStudentFromClassAction` 1551–1555              |
| `_bulkEnrollStudentsAction` 1158–1179                  | admin                        | `bulkEnrollStudentsAction` 1556–1560                  |
| `_createClassAction` 1181–1221                         | admin                        | `createClassAction` 1561–1565                         |
| `_updateClassAction` 1223–1285                         | admin                        | `updateClassAction` 1566–1570                         |
| `_deleteClassAction` 1287–1309                         | admin                        | `deleteClassAction` 1571–1575                         |
| `_previewStripeSubscriptionForConsolidation` 1315–1323 | admin                        | `previewStripeSubscriptionForConsolidation` 1576–1580 |
| `_consolidateDugsiSubscription` 1325–1364              | admin                        | `consolidateDugsiSubscription` 1581–1585              |
| `_sendPaymentLinkViaWhatsAppAction` 1370–1404          | admin                        | `sendPaymentLinkViaWhatsAppAction` 1586–1590          |

### Dugsi non-action declarations

- L118 logger `createServiceLogger('dugsi-admin-actions')`
- L121–132 `fillVCardName` (vCard only)
- Schemas L138–235: `StudentIdSchema` 138, `SubscriptionIdSchema` 139, `ParentEmailSchema` 140, `ClassIdSchema` 141, `ShiftFilterSchema` 142–144, `LinkSubscriptionSchema` 146–149, `VerifyBankSchema` 151–154, `UpdateParentInfoSchema` 156–162, `AddSecondParentSchema` 164–170, `SetPrimaryPayerSchema` 172–175, `UpdateChildInfoSchema` 177–186, `AddChildToFamilySchema` 188–197, `GenerateFamilyPaymentLinkSchema` 199–203, `BulkPaymentLinksSchema` 205–207, `PaymentHistorySchema` 209–213, `SendPaymentLinkViaWhatsAppSchema` 215–235. No schema is shared across domains.
- Exported types L241–264: `SendPaymentLinkWithWhatsAppInput`/`SendPaymentLinkViaWhatsAppInput` 241–243, `GenerateFamilyPaymentLinkInput` 245–249, `FamilyPaymentLinkData` 251–260 (imported by payment-link-dialog.tsx), `WhatsAppSendResult` 262–264.
- Imports from `./_types` (become `../_types`): `SubscriptionValidationData`(subscription), `PaymentStatusData`(payment), `BankVerificationData`(payment), `SubscriptionLinkData`(subscription), `DugsiRegistration`(read+family), `ClassWithDetails`(class), `StudentForEnrollment`(class), `StripePaymentHistoryItem`(payment), `UnassignedStudent`(class).
- Imports from `./_schemas/dialog-schemas` (become `../_schemas/dialog-schemas`): `previewSubscriptionInputSchema`, `consolidateSubscriptionInputSchema` (subscription).
- Imports from `./_utils/family` (become `../_utils/family`): `isActiveDugsiRegistration`, `isChurnedDugsiRegistration` (read/vCard).
- vCard-only imports: `normalizeEmail`, `normalizePhone`, `formatFullName`, `formatPhoneForVCard`, `generateVCardsContent`, `getDateString`, `VCardContact`, `VCardResult` — read-actions.ts. (`normalizeEmail` is vCard-only in this file.)
- Class-only imports: 14 service fns (`getClassesWithDetails`, `getAllTeachersForAssignment`, `getAvailableStudentsForClass`, `getUnassignedDugsiStudents`, `assignTeacherToClass`, `removeTeacherFromClass`, `enrollStudentInClass`, `removeStudentFromClass`, `bulkEnrollStudents`, `createClass`, `updateClass`, `deleteClass`, `getClassById`, `getClassPreviewForDelete`), `ClassNotFoundError`, `TeacherNotAuthorizedError`, 8 class schemas from `@/lib/validations/dugsi`, `getTeachersByProgramService`, `Prisma`, `GradeLevel` (schemas in family), `Shift` (read + class), `SubscriptionStatus` (read).
- Service imports spanning domains (split per referencing action, see referenced-at lines in the mapping): `getAllDugsiRegistrations`(read), `getFamilyMembersService`/`getDeleteFamilyPreviewService`/`deleteDugsiFamilyService`/`updateParentInfoService`/`addSecondParentService`/`updateChildInfoService`/`addChildToFamilyService`/`reEnrollChildService`/`setPrimaryPayerService`/`updateFamilyShiftService`/`syncFamilyBillingRateService`+`SyncFamilyBillingResult`+`FamilyBillingControlSchema`+`ReEnrollChildSchema`+`UpdateFamilyShiftSchema`(family), `validateDugsiSubscriptionService`/`linkDugsiSubscriptionService`/`previewStripeSubscriptionService`+`StripeSubscriptionPreview`/`consolidateStripeSubscriptionService`+`ConsolidateSubscriptionResult`(subscription), `verifyBankAccount`/`getPaymentStatus`/`createDugsiCheckoutSession`/`sendPaymentLink`/`getDugsiStripeClient`/`DUGSI_PROGRAM`(payment; `DUGSI_PROGRAM` also class via `getTeachersByProgramService(DUGSI_PROGRAM)`).

### Dugsi importers (exact specifiers)

See Task 1 Step 3 table; full specifier lists: classes/page.tsx (`getClassesWithDetailsAction`, `getAllTeachersForClassAssignmentAction`, `getUnassignedStudentsAction`); class-management.tsx (`assignTeacherToClassAction`, `removeTeacherFromClassAction`); student-enrollment-dialog.tsx (`bulkEnrollStudentsAction`, `getAvailableStudentsForClassAction`, `removeStudentFromClassAction`); delete-class-dialog.tsx (`deleteClassAction`, `getClassDeletePreviewAction`); class-form-dialog.tsx (`createClassAction`, `updateClassAction`); unassigned-students-section.tsx (`bulkEnrollStudentsAction`); payment-status-section.tsx (`getDugsiPaymentStatus`); dashboard-header.tsx (`generateDugsiVCardContent`); verify-bank-dialog.tsx (`verifyDugsiBankAccount`); edit-parent-dialog.tsx (`updateParentInfo`, `addSecondParent`); payment-link-dialog.tsx (`generateFamilyPaymentLinkAction`, `sendPaymentLinkViaWhatsAppAction`, `type FamilyPaymentLinkData`); consolidate-subscription-dialog.tsx (`previewStripeSubscriptionForConsolidation`, `consolidateDugsiSubscription`); edit-child-dialog.tsx (`updateChildInfo`); link-subscription-dialog.tsx (`linkDugsiSubscription`, `validateDugsiSubscription`); add-child-dialog.tsx (`addChildToFamily`); delete-family-dialog.tsx (`deleteDugsiFamily`, `getDeleteFamilyPreview`); bulk-actions-bar.tsx (`bulkGeneratePaymentLinksAction`); family-detail-sheet.tsx (`updateFamilyShift`); billing-tab.tsx (`getFamilyPaymentHistory`, `recalculateFamilyRate`); overview-tab.tsx (`reEnrollChild`, `setPrimaryPayer`); vcard-action.test.ts (`generateDugsiVCardContent`).

### Mahad `app/admin/mahad/_actions/index.ts` — defs and wrappers

| Private def (lines)                               | Wrapper (lines)                                   | Bucket  |
| ------------------------------------------------- | ------------------------------------------------- | ------- |
| `_createBatchAction` 154–196                      | `createBatchAction` 198–202                       | batch   |
| `_deleteBatchAction` 204–240                      | `deleteBatchAction` 242–246                       | batch   |
| `_updateBatchAction` 248–296                      | `updateBatchAction` 298–302                       | batch   |
| `_assignStudentsAction` 308–348                   | `assignStudentsAction` 350–354                    | batch   |
| `_transferStudentsAction` 356–423                 | `transferStudentsAction` 425–429                  | batch   |
| `_resolveDuplicatesAction` 435–491                | `resolveDuplicatesAction` 493–497                 | student |
| `_getStudentDeleteWarningsAction` 503–509         | `getStudentDeleteWarningsAction` 511–515          | student |
| `_deleteStudentAction` 517–536                    | `deleteStudentAction` 538–542                     | student |
| `_bulkDeleteStudentsAction` 544–562               | `bulkDeleteStudentsAction` 564–568                | student |
| `_updateStudentAction` 570–643                    | `updateStudentAction` 645–649                     | student |
| `_generatePaymentLinkWithOverrideAction` 680–1004 | `generatePaymentLinkWithOverrideAction` 1006–1010 | payment |

All 11 on `adminActionClient`.

### Mahad non-action declarations

- L67 logger `createActionLogger('mahad')` — used only inside the payment action → payment-actions.ts only.
- L69–77 `isStaleStripeCustomer` — payment only.
- L83–86 `AssignmentResult`, L87–90 `TransferResult` (module-private types) — batch.
- Schemas: `createBatchInputSchema` 96–104, `deleteBatchInputSchema` 106–108, `updateBatchInputSchema` 110–120 (batch); `updateStudentInputSchema` 122–124, `resolveDuplicatesInputSchema` 126–132, `studentIdInputSchema` 134–136, `bulkDeleteInputSchema` 138–142 (student); `paymentLinkWithOverrideInputSchema` 144–148 (payment).
- Exported interfaces: `GeneratePaymentLinkInput` 655–659, `PaymentLinkWithOverrideData` 661–674 — payment-actions.ts, stay exported (zero importers today).
- Import placement: batch gets the 7 batch query fns + `isPrismaError` + `CreateBatchSchema`/`UpdateBatchSchema`/`BatchAssignmentSchema`/`BatchTransferSchema`; student gets `getStudentById`, `resolveDuplicateStudents`, `getStudentDeleteWarnings`, mutation-service fns (`deleteStudentProfile`, `bulkDeleteStudentProfiles`, `updateStudentProfile`), `normalizeEmail`/`normalizePhone`, `UpdateStudentSchema`, `isPrismaError`, `BulkDeleteResult`/`DeleteWarnings` types; payment gets `featureFlags`, `getProfileForPaymentLink`, `getMahadStripeCustomerId`, `hasLiveMahadSubscription`, `LIVE_SUBSCRIPTION_STATUSES`, `getMahadKeys`, `logError`, `getMahadStripeClient`, `validateBillingCycleAnchor`, `calculateMahadRate`/`getStripeInterval`, `BillingStartDateSchema`/`OverrideAmountSchema`, `MAX_EXPECTED_RATE_CENTS`, `GraduationStatus`/`PaymentFrequency`/`StudentBillingType`.
- `revalidatePath`/`revalidateTag`/`after`: batch and student files need all three; payment action does not revalidate (verify against source at move time).

### Mahad importers

student-details-content.tsx L17 (`updateStudentAction`); delete-student-dialog.tsx L21–24 (`deleteStudentAction`, `getStudentDeleteWarningsAction`); resolve-duplicates-dialog.tsx L23 (`resolveDuplicatesAction`); assign-students-dialog.tsx L30 (`assignStudentsAction`); batch-form-dialog.tsx L23 (`createBatchAction`, `updateBatchAction`); payment-link-dialog.tsx L40 (`generatePaymentLinkWithOverrideAction`); `_actions/__tests__/actions.test.ts` L205–217 (all 11, from `'../index'`).
