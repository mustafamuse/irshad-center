# Scholarship Safe-Action Migration (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the last rule-20 violation by migrating `submitScholarshipApplication` to `rateLimitedActionClient`, remove the dead react-query dependency, and delete the stale `safe-action-migration` skill.

**Architecture:** The scholarship action moves from a hand-rolled plain `'use server'` function (manual rate limit, manual `safeParse`, custom result shape) to the house safe-action pattern: private `rateLimitedActionClient` chain + exported async wrapper. The form callsite adapts to the next-safe-action result shape. React-query providers are unwrapped (no hook uses them anywhere in the repo — verified 2026-08-04).

**Tech Stack:** Next.js 15 server actions, next-safe-action v8, Zod, Vitest.

## Global Constraints

- Zero user-visible behavior change: identical toast messages, identical email/PDF behavior.
- Never use `any` type (rule 7). New files `.ts`/`.tsx` only (rule 9).
- `ActionError` only with codes from `ERROR_CODES` (rule 22).
- Run tests with `bun run test <path>` (never npx vitest).
- The scholarship rate-limit budget stays at 5 attempts per window (was `checkRateLimit('scholarship-submit:${ip}', 5)`); the client keys it as `submitScholarshipApplication:<ip>` via `metadata.maxAttempts`.
- Behavior deltas that ARE intended (security hardening, spec-approved): rate limiting now fails closed on Upstash outage (public surface, matches `rateLimitedActionClient`); a missing IP header falls into the shared `'unknown'` bucket instead of skipping the limiter.

---

### Task 1: Migrate the action to rateLimitedActionClient (TDD)

**Files:**

- Rewrite: `app/mahad/scholarship/_actions/index.tsx` (169 lines currently)
- Test (create): `app/mahad/scholarship/_actions/__tests__/index.test.ts`

**Interfaces:**

- Consumes: `rateLimitedActionClient` from `@/lib/safe-action`; `scholarshipApplicationSchema` from `../_schemas`; `formatPDFData` from `../_lib/format-data`; `generateScholarshipPDF` from `../_lib/generate-pdf`; `sendEmail`, `sendConfirmationEmail`, `EMAIL_CONFIG` from `@/lib/email/email-service`; `ScholarshipApplicationEmail` from `../_templates/email/scholarship`; `sanitizeFilename` from `@/lib/utils/sanitize`.
- Produces: `submitScholarshipApplication(input)` returning the next-safe-action result `{ data?: { message: string }, serverError?: string, validationErrors?: ... }`. The old `SubmitScholarshipResult` interface is deleted. Task 2 consumes this.

- [ ] **Step 1: Write the failing test**

Create `app/mahad/scholarship/_actions/__tests__/index.test.ts`. The safe-action mock is the established house pattern (copied from `app/mahad/(forms)/register/_actions/__tests__/index.test.ts`); schemas are real per testing rules.

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGeneratePDF,
  mockFormatPDFData,
  mockRender,
  mockSendEmail,
  mockSendConfirmationEmail,
  mockLogError,
  mockLogWarning,
  mockCheckRateLimit,
  mockHeaders,
} = vi.hoisted(() => ({
  mockGeneratePDF: vi.fn(),
  mockFormatPDFData: vi.fn(),
  mockRender: vi.fn(),
  mockSendEmail: vi.fn(),
  mockSendConfirmationEmail: vi.fn(),
  mockLogError: vi.fn(),
  mockLogWarning: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockHeaders: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}))

vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

vi.mock('@react-email/components', () => ({
  render: (...args: unknown[]) => mockRender(...args),
}))

vi.mock('@/lib/email/email-service', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  sendConfirmationEmail: (...args: unknown[]) =>
    mockSendConfirmationEmail(...args),
  EMAIL_CONFIG: { adminEmail: 'admin@example.com' },
}))

vi.mock('../../_lib/format-data', () => ({
  formatPDFData: (...args: unknown[]) => mockFormatPDFData(...args),
}))

vi.mock('../../_lib/generate-pdf', () => ({
  generateScholarshipPDF: (...args: unknown[]) => mockGeneratePDF(...args),
}))

vi.mock('../../_templates/email/scholarship', () => ({
  ScholarshipApplicationEmail: () => null,
}))

vi.mock('@/lib/logger', () => ({
  createActionLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logError: (...args: unknown[]) => mockLogError(...args),
  logWarning: (...args: unknown[]) => mockLogWarning(...args),
}))

vi.mock('@/lib/safe-action', () => ({
  rateLimitedActionClient: {
    metadata: (meta: { actionName: string; maxAttempts?: number }) => ({
      schema: (schema: {
        safeParse: (input: unknown) => {
          success: boolean
          data?: unknown
          error?: { flatten: () => { fieldErrors: Record<string, string[]> } }
        }
      }) => ({
        action:
          (handler: (opts: { parsedInput: unknown }) => Promise<unknown>) =>
          async (input: unknown) => {
            const h = await mockHeaders()
            const ip =
              h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
            const rateResult = await mockCheckRateLimit(
              `${meta.actionName}:${ip}`,
              meta.maxAttempts,
              { failClosed: true }
            )
            if (!rateResult.success) {
              return {
                serverError: 'Too many attempts. Please try again later.',
              }
            }
            const parsed = schema.safeParse(input)
            if (!parsed.success) {
              return { validationErrors: parsed.error!.flatten().fieldErrors }
            }
            try {
              return { data: await handler({ parsedInput: parsed.data }) }
            } catch (e) {
              if (e instanceof Error && 'code' in e) {
                return { serverError: e.message }
              }
              return { serverError: 'Something went wrong' }
            }
          },
      }),
    }),
  },
}))

import { submitScholarshipApplication } from '../index'

const VALID_INPUT = {
  studentName: 'Test Student',
  className: 'Batch 3',
  email: 'student@example.com',
  phone: '6125551234',
  payer: 'self' as const,
  educationStatus: 'not-studying' as const,
  householdSize: '4',
  dependents: '2',
  adultsInHousehold: '2',
  livesWithBothParents: 'yes' as const,
  isEmployed: 'no' as const,
  monthlyIncome: null,
  needJustification: 'n'.repeat(60),
  goalSupport: 'g'.repeat(60),
  commitment: 'c'.repeat(60),
  termsAgreed: true,
}

describe('submitScholarshipApplication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHeaders.mockResolvedValue(new Headers({ 'x-forwarded-for': '1.2.3.4' }))
    mockCheckRateLimit.mockResolvedValue({ success: true })
    mockFormatPDFData.mockReturnValue({ formatted: true })
    mockGeneratePDF.mockResolvedValue(Buffer.from('pdf'))
    mockRender.mockResolvedValue('<html></html>')
    mockSendEmail.mockResolvedValue({ success: true })
    mockSendConfirmationEmail.mockResolvedValue(undefined)
  })

  it('submits successfully: PDF generated, admin email with attachment, confirmation sent', async () => {
    const result = await submitScholarshipApplication(VALID_INPUT)

    expect(result).toEqual({
      data: { message: 'Your application has been submitted successfully' },
    })
    expect(mockGeneratePDF).toHaveBeenCalledWith({ formatted: true })
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: 'Scholarship Application - Test Student',
        replyTo: 'student@example.com',
        attachments: [
          expect.objectContaining({
            filename: expect.stringContaining('scholarship-application-'),
          }),
        ],
      })
    )
    expect(mockSendConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'student@example.com' })
    )
  })

  it('returns serverError when PDF generation fails', async () => {
    mockGeneratePDF.mockRejectedValue(new Error('boom'))

    const result = await submitScholarshipApplication(VALID_INPUT)

    expect(result).toEqual({
      serverError: 'Failed to generate application PDF. Please try again.',
    })
    expect(mockSendEmail).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalled()
  })

  it('returns serverError when the admin email fails', async () => {
    mockSendEmail.mockResolvedValue({ success: false })

    const result = await submitScholarshipApplication(VALID_INPUT)

    expect(result).toEqual({
      serverError:
        'Failed to send application email. Please try again or contact support.',
    })
    expect(mockSendConfirmationEmail).not.toHaveBeenCalled()
  })

  it('still succeeds when the confirmation email fails', async () => {
    mockSendConfirmationEmail.mockRejectedValue(new Error('smtp down'))

    const result = await submitScholarshipApplication(VALID_INPUT)

    expect(result).toEqual({
      data: { message: 'Your application has been submitted successfully' },
    })
    expect(mockLogWarning).toHaveBeenCalled()
  })

  it('returns validationErrors for invalid input', async () => {
    const result = await submitScholarshipApplication({
      ...VALID_INPUT,
      termsAgreed: false,
    })

    expect(result).toHaveProperty('validationErrors')
    expect(mockGeneratePDF).not.toHaveBeenCalled()
  })

  it('returns the rate-limit message when throttled', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false })

    const result = await submitScholarshipApplication(VALID_INPUT)

    expect(result).toEqual({
      serverError: 'Too many attempts. Please try again later.',
    })
    expect(mockGeneratePDF).not.toHaveBeenCalled()
  })

  it('keeps the 5-attempt budget on the rate limiter', async () => {
    await submitScholarshipApplication(VALID_INPUT)

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'submitScholarshipApplication:1.2.3.4',
      5,
      { failClosed: true }
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test app/mahad/scholarship/_actions/__tests__/index.test.ts`
Expected: FAIL — the current implementation returns `{ success: true, message: ... }` / `{ success: false, error: ... }`, not the safe-action shape, and never calls the mocked client.

- [ ] **Step 3: Rewrite the action**

Replace the entire contents of `app/mahad/scholarship/_actions/index.tsx` with:

```tsx
'use server'

import React from 'react'

import { render } from '@react-email/components'

import {
  sendEmail,
  sendConfirmationEmail,
  EMAIL_CONFIG,
} from '@/lib/email/email-service'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createActionLogger, logError, logWarning } from '@/lib/logger'
import { rateLimitedActionClient } from '@/lib/safe-action'
import { sanitizeFilename } from '@/lib/utils/sanitize'

import { formatPDFData } from '../_lib/format-data'
import { generateScholarshipPDF } from '../_lib/generate-pdf'
import { scholarshipApplicationSchema } from '../_schemas'
import { ScholarshipApplicationEmail } from '../_templates/email/scholarship'

const logger = createActionLogger('scholarship-application')

const _submitScholarshipApplication = rateLimitedActionClient
  .metadata({ actionName: 'submitScholarshipApplication', maxAttempts: 5 })
  .schema(scholarshipApplicationSchema)
  .action(async ({ parsedInput: validatedData }) => {
    const pdfData = formatPDFData(validatedData)

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateScholarshipPDF(pdfData)
    } catch (error) {
      await logError(logger, error, 'PDF generation failed', {
        studentName: validatedData.studentName,
      })
      throw new ActionError(
        'Failed to generate application PDF. Please try again.',
        ERROR_CODES.SERVER_ERROR
      )
    }

    const emailHtml = await render(
      <ScholarshipApplicationEmail
        studentName={validatedData.studentName}
        studentEmail={validatedData.email}
        className={validatedData.className}
        phone={validatedData.phone}
      />
    )

    const emailResult = await sendEmail({
      to: EMAIL_CONFIG.adminEmail,
      subject: `Scholarship Application - ${validatedData.studentName}`,
      html: emailHtml,
      attachments: [
        {
          filename: `scholarship-application-${sanitizeFilename(validatedData.studentName)}.pdf`,
          content: pdfBuffer,
        },
      ],
      replyTo: validatedData.email,
    })

    if (!emailResult.success) {
      throw new ActionError(
        'Failed to send application email. Please try again or contact support.',
        ERROR_CODES.SERVER_ERROR
      )
    }

    try {
      await sendConfirmationEmail({
        to: validatedData.email,
        studentName: validatedData.studentName,
        subject: 'Scholarship Application Received',
        message:
          'Thank you for submitting your scholarship application. We have received your application and will review it shortly.',
        nextSteps: [
          'Application review by the Mahad Office',
          'Evaluation of financial need and circumstances',
          'Decision notification via email or in person',
        ],
      })
    } catch (error) {
      await logWarning(logger, 'Failed to send confirmation email to student', {
        error: error instanceof Error ? error.message : 'Unknown error',
        studentEmail: validatedData.email,
      })
    }

    return { message: 'Your application has been submitted successfully' }
  })

export async function submitScholarshipApplication(
  ...args: Parameters<typeof _submitScholarshipApplication>
) {
  return _submitScholarshipApplication(...args)
}
```

Deletions relative to the old file: the `headers`/`checkRateLimit` imports and manual rate-limit block, the manual `safeParse`, the `SubmitScholarshipResult` interface, the outer try/catch with `error.toJSON()`. Verify `logWarning` is exported from `@/lib/logger` (the old file already imported it — it is).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test app/mahad/scholarship/_actions/__tests__/index.test.ts`
Expected: 7/7 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/mahad/scholarship/_actions/
git commit -m "fix(scholarship): migrate submitScholarshipApplication to rateLimitedActionClient"
```

Note: `bunx tsc --noEmit` will FAIL at this point because `form.tsx` still uses `result.success` — that is Task 2. Commit anyway (the plan's tasks are reviewed as a unit before push).

---

### Task 2: Update the form callsite to the safe-action result shape

**Files:**

- Modify: `app/mahad/scholarship/_components/form.tsx:202-216`

**Interfaces:**

- Consumes: `submitScholarshipApplication` from Task 1 — returns `{ data?: { message: string }, serverError?: string, validationErrors?: unknown }`.

- [ ] **Step 1: Replace the result handling**

In `app/mahad/scholarship/_components/form.tsx`, replace this block inside `onSubmit` (currently lines 202–215):

```tsx
// Call Server Action
const result = await submitScholarshipApplication(formData)

if (!result.success) {
  toasts.apiError({
    title: 'Submission Failed',
    error: new Error(result.error || 'Please try again'),
  })
  setIsSubmitting(false)
  return
}

toasts.success('Success!', result.message || 'Application submitted')
```

with:

```tsx
// Call Server Action
const result = await submitScholarshipApplication(formData)

if (result?.serverError || result?.validationErrors) {
  toasts.apiError({
    title: 'Submission Failed',
    error: new Error(
      result.serverError ??
        'Invalid form data. Please check all required fields.'
    ),
  })
  setIsSubmitting(false)
  return
}

toasts.success('Success!', result?.data?.message || 'Application submitted')
```

No other changes to the file. The messages match the old behavior exactly: server failures show their `ActionError` message, validation failures show the old "Invalid form data. Please check all required fields." copy.

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: clean (this resolves the deliberate Task 1 breakage).

- [ ] **Step 3: Run the full scholarship test set**

Run: `bun run test app/mahad/scholarship`
Expected: all pass (action tests + existing `_schemas` tests).

- [ ] **Step 4: Commit**

```bash
git add app/mahad/scholarship/_components/form.tsx
git commit -m "fix(scholarship): adapt form to safe-action result shape"
```

---

### Task 3: Remove dead react-query

**Files:**

- Modify: `app/providers.tsx`
- Modify: `app/dugsi/register/providers.tsx`
- Modify: `package.json` (+ `bun.lock` via bun)

Pre-verified 2026-08-04: `grep -rn 'useQuery\|useMutation\|useQueryClient' app lib components hooks` matches nothing — the two `QueryClientProvider` wrappers are the only usage. Re-run that grep first; if it now matches anything, STOP and report instead of proceeding.

- [ ] **Step 1: Unwrap `app/providers.tsx`**

Replace the entire file with:

```tsx
'use client'

import { ReactNode } from 'react'

import { NuqsAdapter } from 'nuqs/adapters/next/app'

export function Providers({ children }: { children: ReactNode }) {
  return <NuqsAdapter>{children}</NuqsAdapter>
}
```

- [ ] **Step 2: Unwrap `app/dugsi/register/providers.tsx`**

Replace the entire file with:

```tsx
'use client'

import { AppErrorBoundary } from '@/components/error-boundary'
import { IntlProviderWrapper } from '@/components/intl-provider-wrapper'
import { LanguageProvider } from '@/contexts/language-context'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <LanguageProvider>
      <IntlProviderWrapper>
        <AppErrorBoundary context="Dugsi registration" variant="inline">
          {children}
        </AppErrorBoundary>
      </IntlProviderWrapper>
    </LanguageProvider>
  )
}
```

- [ ] **Step 3: Remove the packages**

```bash
bun remove @tanstack/react-query @tanstack/react-query-devtools
```

Keep `@tanstack/react-table` and `@tanstack/react-virtual` (in real use).

- [ ] **Step 4: Verify**

Run: `bunx tsc --noEmit && bun run test app/dugsi/register`
Expected: clean typecheck; register tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/providers.tsx app/dugsi/register/providers.tsx package.json bun.lock
git commit -m "chore: remove unused react-query dependency and providers"
```

---

### Task 4: Delete the stale safe-action-migration skill + full verification

**Files:**

- Delete: `.claude/skills/safe-action-migration/` (entire directory)

The skill instructs future sessions to perform "Phase 4" work that a 2026-08-04 audit proved was completed in April 2026 (PRs #219/#220) — it is actively misleading.

- [ ] **Step 1: Delete the skill**

```bash
git rm -r .claude/skills/safe-action-migration
```

- [ ] **Step 2: Full verification**

```bash
bunx tsc --noEmit && bun run lint && bun run test
```

Expected: typecheck clean, lint clean, full suite green (~1512+ tests).

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: delete stale safe-action-migration skill (migration completed in PR 219/220)"
```
