# Mahad Registration Recovery-Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Mahad registration enrich the 16 contact-less recovery profiles (via signed invite links and a name fallback) instead of creating duplicates.

**Architecture:** A small HMAC token module identifies a target profile in invite links; `registerMahadStudent` gains an enrichment path that fills null fields on an existing Person/ProgramProfile and reuses its active Enrollment; when no invite and no email/phone match exists, a tightly scoped name lookup (contact-less Persons with a Mahad profile only) routes into the same enrichment path. A read-only script prints the invite URLs.

**Tech Stack:** Next.js 15 App Router, next-safe-action (rateLimitedActionClient), Prisma, Zod, Vitest, node:crypto.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-03-mahad-registration-recovery-design.md`.
- Token format `<profileId>.<sig>`, sig = hex HMAC-SHA256 of profileId with env `MAHAD_INVITE_SECRET`, truncated to 32 hex chars; verification timing-safe; missing env → verify returns null, create throws.
- Invalid/dead invite token NEVER errors — always falls through to the normal registration flow (page and submit).
- Name fallback fires only when `checkDuplicate` found nothing, and only merges when EXACTLY ONE Person matches (name equals case-insensitive, `email: null`, `phone: null`, has a MAHAD_PROGRAM profile). 0 or 2+ → create fresh.
- Enrichment fills null fields only, never overwrites; Person.name never changed; `paymentNotes` appends after existing content; `monthlyRate` untouched; never create a second active Enrollment; the public form sends no batchId, so existing enrollments are left untouched.
- Existing 409 DUPLICATE_CONTACT and P2002 handling unchanged.
- No `any`; no comments except complex business logic; no emojis; new files `.ts`/`.tsx`; tests with `bunx vitest run <file>`; full suite `bun run test`; `bunx tsc --noEmit` clean before each commit.
- Extend the existing test files and their vi.hoisted mock harness — do not rewrite them.
- Commit after every task. Work only in the mahad-registration worktree; verify `git rev-parse --abbrev-ref HEAD` prints `mahad-registration` before ANY commit.

---

### Task 1: Invite token module

**Files:**

- Create: `lib/utils/invite-token.ts`
- Test: `lib/utils/__tests__/invite-token.test.ts` (new)
- Modify: `.env.example` (add `MAHAD_INVITE_SECRET=`)

**Interfaces:**

- Produces: `createInviteToken(profileId: string): string`, `verifyInviteToken(token: string | null | undefined): string | null`. Later tasks import from `@/lib/utils/invite-token`.

- [ ] **Step 1: Write the failing tests**

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createInviteToken, verifyInviteToken } from '../invite-token'

const PROFILE_ID = 'a1b2c3d4-0000-4000-8000-000000000001'

describe('invite-token', () => {
  beforeEach(() => {
    process.env.MAHAD_INVITE_SECRET = 'test-secret'
  })
  afterEach(() => {
    delete process.env.MAHAD_INVITE_SECRET
  })

  it('round-trips create -> verify', () => {
    const token = createInviteToken(PROFILE_ID)
    expect(verifyInviteToken(token)).toBe(PROFILE_ID)
  })

  it('token shape is profileId.32-hex-sig', () => {
    const token = createInviteToken(PROFILE_ID)
    const [id, sig] = token.split('.')
    expect(id).toBe(PROFILE_ID)
    expect(sig).toMatch(/^[0-9a-f]{32}$/)
  })

  it('rejects a tampered signature', () => {
    const token = createInviteToken(PROFILE_ID)
    const [id, sig] = token.split('.')
    const flipped = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1)
    expect(verifyInviteToken(`${id}.${flipped}`)).toBeNull()
  })

  it('rejects a token signed for a different profile', () => {
    const other = createInviteToken('a1b2c3d4-0000-4000-8000-000000000002')
    const [, sig] = other.split('.')
    expect(verifyInviteToken(`${PROFILE_ID}.${sig}`)).toBeNull()
  })

  it.each(['', 'no-dot', 'a.b.c', `${PROFILE_ID}.zzzz`, null, undefined])(
    'rejects malformed input %#',
    (bad) => {
      expect(verifyInviteToken(bad as string)).toBeNull()
    }
  )

  it('verify returns null when MAHAD_INVITE_SECRET is unset', () => {
    const token = createInviteToken(PROFILE_ID)
    delete process.env.MAHAD_INVITE_SECRET
    expect(verifyInviteToken(token)).toBeNull()
  })

  it('create throws when MAHAD_INVITE_SECRET is unset', () => {
    delete process.env.MAHAD_INVITE_SECRET
    expect(() => createInviteToken(PROFILE_ID)).toThrow()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bunx vitest run lib/utils/__tests__/invite-token.test.ts`
Expected: FAIL — cannot resolve `../invite-token`.

- [ ] **Step 3: Implement**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

const SIG_LENGTH = 32

function sign(profileId: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(profileId)
    .digest('hex')
    .slice(0, SIG_LENGTH)
}

export function createInviteToken(profileId: string): string {
  const secret = process.env.MAHAD_INVITE_SECRET
  if (!secret) {
    throw new Error('MAHAD_INVITE_SECRET is not set')
  }
  return `${profileId}.${sign(profileId, secret)}`
}

export function verifyInviteToken(
  token: string | null | undefined
): string | null {
  const secret = process.env.MAHAD_INVITE_SECRET
  if (!secret || !token) return null

  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [profileId, sig] = parts
  if (!profileId || sig.length !== SIG_LENGTH) return null

  const expected = sign(profileId, secret)
  const a = Buffer.from(sig, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return null
  return timingSafeEqual(a, b) ? profileId : null
}
```

Also append to `.env.example`:

```
MAHAD_INVITE_SECRET=
```

- [ ] **Step 4: Run to verify pass**

Run: `bunx vitest run lib/utils/__tests__/invite-token.test.ts`
Expected: all pass. Then `bunx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add lib/utils/invite-token.ts lib/utils/__tests__/invite-token.test.ts .env.example
git commit -m "feat(mahad): invite token module for recovery registration links"
```

---

### Task 2: Service enrichment path (inviteProfileId)

**Files:**

- Modify: `lib/services/mahad/registration-service.ts`
- Test: `lib/services/mahad/__tests__/registration-service.test.ts` (extend)

**Interfaces:**

- Consumes: nothing new (token verification happens in the action, Task 4).
- Produces: `MahadRegistrationInput` gains `inviteProfileId?: string | null`. When set and valid, the service enriches that profile and returns its id. `registerMahadStudent` signature otherwise unchanged: `(input: MahadRegistrationInput) => Promise<{ profileId: string }>`.

**Mock harness note:** the existing `mockTx` (vi.hoisted) has `person.create/update`, `programProfile.create`, `enrollment.create`. Extend the hoisted block with `mockProgramProfileFindUnique`, `mockProgramProfileUpdate`, `mockEnrollmentCreate` stays, and wire them into `mockTx` as `programProfile.findUnique` / `programProfile.update`. Follow the existing `(...args: unknown[]) => mockX(...args)` style.

- [ ] **Step 1: Write the failing tests** (append a new `describe` block)

```ts
describe('invite enrichment path', () => {
  const inviteProfile = {
    id: 'profile-recovery-1',
    program: 'MAHAD_PROGRAM',
    gradeLevel: null,
    schoolName: null,
    graduationStatus: null,
    paymentFrequency: null,
    billingType: null,
    paymentNotes:
      'Created from attendance roster during 2026-08 billing recovery; billing pending checkout',
    person: {
      id: 'person-recovery-1',
      name: 'Habib Idris',
      email: null,
      phone: null,
      dateOfBirth: null,
    },
    enrollments: [{ id: 'enr-1', endDate: null }],
  }

  beforeEach(() => {
    mockCheckDuplicate.mockResolvedValue(noDuplicateResult)
    mockProgramProfileFindUnique.mockResolvedValue(inviteProfile)
    mockPersonUpdate.mockResolvedValue({})
    mockProgramProfileUpdate.mockResolvedValue({ id: inviteProfile.id })
  })

  it('enriches the invited profile and returns its id', async () => {
    const result = await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
    })
    expect(result.profileId).toBe('profile-recovery-1')
    expect(mockPersonCreate).not.toHaveBeenCalled()
    expect(mockProgramProfileCreate).not.toHaveBeenCalled()
  })

  it('fills person nulls without overwriting existing values', async () => {
    mockProgramProfileFindUnique.mockResolvedValue({
      ...inviteProfile,
      person: { ...inviteProfile.person, email: 'kept@example.com' },
    })
    await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
    })
    const update = mockPersonUpdate.mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    expect(update.data.email).toBeUndefined()
    expect(update.data.phone).toBeDefined()
  })

  it('does not create a second enrollment when one is active', async () => {
    await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
    })
    expect(mockEnrollmentCreate).not.toHaveBeenCalled()
  })

  it('creates an enrollment when the profile has none active', async () => {
    mockProgramProfileFindUnique.mockResolvedValue({
      ...inviteProfile,
      enrollments: [],
    })
    await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
    })
    expect(mockEnrollmentCreate).toHaveBeenCalledTimes(1)
  })

  it('falls through to normal create when the profile does not exist', async () => {
    mockProgramProfileFindUnique.mockResolvedValue(null)
    mockPersonCreate.mockResolvedValue({ id: 'person-new' })
    mockProgramProfileCreate.mockResolvedValue({ id: 'profile-new' })
    const result = await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-gone',
    })
    expect(result.profileId).toBe('profile-new')
  })

  it('falls through when the invited profile is not Mahad', async () => {
    mockProgramProfileFindUnique.mockResolvedValue({
      ...inviteProfile,
      program: 'DUGSI_PROGRAM',
    })
    mockPersonCreate.mockResolvedValue({ id: 'person-new' })
    mockProgramProfileCreate.mockResolvedValue({ id: 'profile-new' })
    const result = await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
    })
    expect(result.profileId).toBe('profile-new')
  })

  it('still 409s on duplicate contact even with an invite', async () => {
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: true,
      duplicateField: 'email',
      existingPerson: {
        id: 'p-x',
        email: 'x@x.com',
        phone: null,
        dateOfBirth: null,
      },
      hasActiveProfile: true,
    })
    await expect(
      registerMahadStudent({
        ...baseInput,
        inviteProfileId: 'profile-recovery-1',
      })
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('appends the submitted paymentNotes after the recovery marker', async () => {
    await registerMahadStudent({
      ...baseInput,
      inviteProfileId: 'profile-recovery-1',
      paymentNotes: 'prefers cash',
    })
    const update = mockProgramProfileUpdate.mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    expect(update.data.paymentNotes).toContain('billing pending checkout')
    expect(update.data.paymentNotes).toContain('prefers cash')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bunx vitest run lib/services/mahad/__tests__/registration-service.test.ts`
Expected: new tests FAIL (`inviteProfileId` unknown / findUnique never called); existing tests still pass.

- [ ] **Step 3: Implement**

In `registration-service.ts`:

1. Add `inviteProfileId?: string | null` to `MahadRegistrationInput`.
2. Add a module-private helper (above `registerMahadStudent`):

```ts
type EnrichableProfile = {
  id: string
  gradeLevel: GradeLevel | null
  schoolName: string | null
  graduationStatus: GraduationStatus | null
  paymentFrequency: PaymentFrequency | null
  billingType: StudentBillingType | null
  paymentNotes: string | null
  person: {
    id: string
    email: string | null
    phone: string | null
    dateOfBirth: Date | null
  }
  enrollments: { id: string }[]
}

async function enrichExistingProfile(
  tx: Prisma.TransactionClient,
  profile: EnrichableProfile,
  input: MahadRegistrationInput,
  normalizedEmail: string | null,
  normalizedPhone: string | null
): Promise<{ profileId: string }> {
  const personUpdates: Prisma.PersonUpdateInput = {}
  if (normalizedEmail && !profile.person.email)
    personUpdates.email = normalizedEmail
  if (normalizedPhone && !profile.person.phone)
    personUpdates.phone = normalizedPhone
  if (input.dateOfBirth && !profile.person.dateOfBirth)
    personUpdates.dateOfBirth = input.dateOfBirth
  if (Object.keys(personUpdates).length > 0) {
    await tx.person.update({
      where: { id: profile.person.id },
      data: personUpdates,
    })
  }

  const profileUpdates: Prisma.ProgramProfileUpdateInput = {}
  if (input.gradeLevel && !profile.gradeLevel)
    profileUpdates.gradeLevel = input.gradeLevel
  if (input.schoolName && !profile.schoolName)
    profileUpdates.schoolName = input.schoolName
  if (input.graduationStatus && !profile.graduationStatus)
    profileUpdates.graduationStatus = input.graduationStatus
  if (input.paymentFrequency && !profile.paymentFrequency)
    profileUpdates.paymentFrequency = input.paymentFrequency
  if (input.billingType && !profile.billingType)
    profileUpdates.billingType = input.billingType
  if (input.paymentNotes) {
    profileUpdates.paymentNotes = profile.paymentNotes
      ? `${profile.paymentNotes}; ${input.paymentNotes}`
      : input.paymentNotes
  }
  if (Object.keys(profileUpdates).length > 0) {
    await tx.programProfile.update({
      where: { id: profile.id },
      data: profileUpdates,
    })
  }

  if (profile.enrollments.length === 0) {
    await tx.enrollment.create({
      data: {
        programProfileId: profile.id,
        batchId: input.batchId ?? null,
        status: 'REGISTERED',
        startDate: new Date(),
      },
    })
  }

  return { profileId: profile.id }
}
```

3. Inside the transaction, after the existing duplicate 409 guard and BEFORE the `existingPerson` branch, insert:

```ts
if (input.inviteProfileId) {
  const invited = await tx.programProfile.findUnique({
    where: { id: input.inviteProfileId },
    select: {
      id: true,
      program: true,
      gradeLevel: true,
      schoolName: true,
      graduationStatus: true,
      paymentFrequency: true,
      billingType: true,
      paymentNotes: true,
      person: {
        select: {
          id: true,
          email: true,
          phone: true,
          dateOfBirth: true,
        },
      },
      enrollments: {
        where: { endDate: null },
        select: { id: true },
      },
    },
  })
  if (invited && invited.program === MAHAD_PROGRAM) {
    return enrichExistingProfile(
      tx,
      invited,
      input,
      normalizedEmail,
      normalizedPhone
    )
  }
}
```

(`MAHAD_PROGRAM` is already imported. `GradeLevel`/`GraduationStatus`/`PaymentFrequency`/`StudentBillingType` are already imported from `@prisma/client`.)

- [ ] **Step 4: Run to verify pass**

Run: `bunx vitest run lib/services/mahad/__tests__/registration-service.test.ts`
Expected: all pass (existing + new). Then `bunx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add lib/services/mahad/registration-service.ts lib/services/mahad/__tests__/registration-service.test.ts
git commit -m "feat(mahad): registration enriches invited recovery profile instead of duplicating"
```

---

### Task 3: Name fallback for the generic link

**Files:**

- Modify: `lib/services/mahad/registration-service.ts`
- Test: `lib/services/mahad/__tests__/registration-service.test.ts` (extend)

**Interfaces:**

- Consumes: `enrichExistingProfile` from Task 2 (same file).
- Produces: no signature change; behavior only.

**Mock harness note:** add `mockPersonFindMany` to the hoisted block and wire `person.findMany` into `mockTx`.

- [ ] **Step 1: Write the failing tests** (append a `describe` block)

```ts
describe('name fallback for contact-less recovery profiles', () => {
  const recoveryPersonMatch = {
    id: 'person-recovery-2',
    email: null,
    phone: null,
    dateOfBirth: null,
    programProfiles: [
      {
        id: 'profile-recovery-2',
        program: 'MAHAD_PROGRAM',
        gradeLevel: null,
        schoolName: null,
        graduationStatus: null,
        paymentFrequency: null,
        billingType: null,
        paymentNotes: null,
        enrollments: [{ id: 'enr-2', endDate: null }],
      },
    ],
  }

  beforeEach(() => {
    mockCheckDuplicate.mockResolvedValue(noDuplicateResult)
    mockPersonUpdate.mockResolvedValue({})
    mockProgramProfileUpdate.mockResolvedValue({})
  })

  it('merges into the single contact-less name match', async () => {
    mockPersonFindMany.mockResolvedValue([recoveryPersonMatch])
    const result = await registerMahadStudent(baseInput)
    expect(result.profileId).toBe('profile-recovery-2')
    expect(mockPersonCreate).not.toHaveBeenCalled()
    expect(mockProgramProfileCreate).not.toHaveBeenCalled()
  })

  it('queries only contact-less persons with a Mahad profile', async () => {
    mockPersonFindMany.mockResolvedValue([])
    mockPersonCreate.mockResolvedValue({ id: 'p-new' })
    mockProgramProfileCreate.mockResolvedValue({ id: 'pp-new' })
    await registerMahadStudent(baseInput)
    const query = mockPersonFindMany.mock.calls[0][0] as {
      where: Record<string, unknown>
    }
    expect(query.where.email).toBeNull()
    expect(query.where.phone).toBeNull()
    expect(query.where.name).toEqual({
      equals: baseInput.name,
      mode: 'insensitive',
    })
  })

  it('creates fresh when zero matches', async () => {
    mockPersonFindMany.mockResolvedValue([])
    mockPersonCreate.mockResolvedValue({ id: 'p-new' })
    mockProgramProfileCreate.mockResolvedValue({ id: 'pp-new' })
    const result = await registerMahadStudent(baseInput)
    expect(result.profileId).toBe('pp-new')
    expect(mockPersonCreate).toHaveBeenCalledTimes(1)
  })

  it('creates fresh when two candidates match', async () => {
    mockPersonFindMany.mockResolvedValue([
      recoveryPersonMatch,
      { ...recoveryPersonMatch, id: 'person-recovery-3' },
    ])
    mockPersonCreate.mockResolvedValue({ id: 'p-new' })
    mockProgramProfileCreate.mockResolvedValue({ id: 'pp-new' })
    const result = await registerMahadStudent(baseInput)
    expect(result.profileId).toBe('pp-new')
  })

  it('does not run the fallback when checkDuplicate found a person', async () => {
    mockCheckDuplicate.mockResolvedValue({
      isDuplicate: false,
      duplicateField: null,
      existingPerson: {
        id: 'person-existing',
        email: 'x@x.com',
        phone: null,
        dateOfBirth: null,
      },
      hasActiveProfile: false,
    })
    mockProgramProfileCreate.mockResolvedValue({ id: 'pp-reuse' })
    await registerMahadStudent(baseInput)
    expect(mockPersonFindMany).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bunx vitest run lib/services/mahad/__tests__/registration-service.test.ts`
Expected: new tests FAIL; existing (including Task 2 block) pass.

- [ ] **Step 3: Implement**

In the transaction, in the `else` branch that currently creates a new Person (i.e. when `dupResult.existingPerson` is null), BEFORE `tx.person.create`:

```ts
const fallbackMatches = await tx.person.findMany({
  where: {
    name: { equals: input.name, mode: 'insensitive' },
    email: null,
    phone: null,
    programProfiles: { some: { program: MAHAD_PROGRAM } },
  },
  select: {
    id: true,
    email: true,
    phone: true,
    dateOfBirth: true,
    programProfiles: {
      where: { program: MAHAD_PROGRAM },
      select: {
        id: true,
        program: true,
        gradeLevel: true,
        schoolName: true,
        graduationStatus: true,
        paymentFrequency: true,
        billingType: true,
        paymentNotes: true,
        enrollments: {
          where: { endDate: null },
          select: { id: true },
        },
      },
    },
  },
  take: 2,
})

if (fallbackMatches.length === 1) {
  const match = fallbackMatches[0]
  const profile = match.programProfiles[0]
  return enrichExistingProfile(
    tx,
    {
      ...profile,
      person: {
        id: match.id,
        email: match.email,
        phone: match.phone,
        dateOfBirth: match.dateOfBirth,
      },
    },
    input,
    normalizedEmail,
    normalizedPhone
  )
}
```

Contact-less persons with a Mahad profile can only come from the recovery
backfill: `mahadRegistrationSchema` requires email and phone, so every
form-created person has contact info. That is what makes exactly-one an
auto-merge-safe condition.

- [ ] **Step 4: Run to verify pass**

Run: `bunx vitest run lib/services/mahad/__tests__/registration-service.test.ts`
Expected: all pass. Then `bunx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add lib/services/mahad/registration-service.ts lib/services/mahad/__tests__/registration-service.test.ts
git commit -m "feat(mahad): name fallback merges generic-link registrations into recovery profiles"
```

---

### Task 4: Action token verification + invite-aware form

**Files:**

- Modify: `lib/registration/schemas/mahad-registration.ts` (add `inviteToken`)
- Modify: `app/mahad/(forms)/register/_actions/index.ts`
- Modify: `app/mahad/(forms)/register/page.tsx`
- Modify: `app/mahad/(forms)/register/_components/registration-form.tsx`
- Modify: `lib/db/queries/program-profile.ts` (add page query)
- Test: `app/mahad/(forms)/register/_actions/__tests__/index.test.ts` (extend)

**Interfaces:**

- Consumes: `verifyInviteToken` (Task 1); `inviteProfileId` service param (Task 2).
- Produces: `mahadRegistrationSchema` gains `inviteToken: z.string().max(200).optional()`; `RegisterForm` gains optional props `{ inviteToken?: string; initialFirstName?: string; initialLastName?: string }`; new query `findMahadProfileNameById(profileId: string, client?: DatabaseClient): Promise<string | null>` (returns the person's name for a MAHAD profile, else null).

- [ ] **Step 1: Write the failing action tests** (extend the existing test file, reusing its mock harness for the service and safe-action; add `vi.mock('@/lib/utils/invite-token', ...)` with a hoisted `mockVerifyInviteToken`)

```ts
describe('invite token handling', () => {
  it('passes the verified profileId to the service', async () => {
    mockVerifyInviteToken.mockReturnValue('profile-recovery-1')
    await registerStudent({ ...validFormInput, inviteToken: 'id.sig' })
    expect(mockRegisterMahadStudent).toHaveBeenCalledWith(
      expect.objectContaining({ inviteProfileId: 'profile-recovery-1' })
    )
  })

  it('treats an invalid token as absent', async () => {
    mockVerifyInviteToken.mockReturnValue(null)
    await registerStudent({ ...validFormInput, inviteToken: 'garbage' })
    expect(mockRegisterMahadStudent).toHaveBeenCalledWith(
      expect.objectContaining({ inviteProfileId: null })
    )
  })

  it('works with no token at all', async () => {
    await registerStudent(validFormInput)
    expect(mockRegisterMahadStudent).toHaveBeenCalledWith(
      expect.objectContaining({ inviteProfileId: null })
    )
  })
})
```

(`validFormInput` = the file's existing valid fixture; add `inviteToken` only where the test needs it.)

- [ ] **Step 2: Run to verify failure**

Run: `bunx vitest run "app/mahad/(forms)/register/_actions/__tests__/index.test.ts"`
Expected: FAIL — schema strips `inviteToken` / service never receives `inviteProfileId`.

- [ ] **Step 3: Implement**

1. Schema (`mahad-registration.ts`): add to the object

```ts
  inviteToken: z.string().max(200).optional(),
```

2. Action (`_actions/index.ts`): import `verifyInviteToken` from `@/lib/utils/invite-token`; inside the action before calling the service:

```ts
const inviteProfileId = verifyInviteToken(data.inviteToken) ?? null
```

and pass `inviteProfileId` in the `registerMahadStudent({ ... })` call.

3. Query (`lib/db/queries/program-profile.ts`), following the file's existing `client: DatabaseClient = prisma` convention:

```ts
export async function findMahadProfileNameById(
  profileId: string,
  client: DatabaseClient = prisma
): Promise<string | null> {
  const profile = await client.programProfile.findUnique({
    where: { id: profileId },
    select: { program: true, person: { select: { name: true } } },
  })
  if (!profile || profile.program !== 'MAHAD_PROGRAM') return null
  return profile.person.name
}
```

4. Page (`page.tsx`): make the component async, read `searchParams`, verify, fetch the name, split for display, pass props:

```tsx
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>
}) {
  const { invite } = await searchParams
  const inviteProfileId = verifyInviteToken(invite)
  let inviteProps: {
    inviteToken?: string
    initialFirstName?: string
    initialLastName?: string
  } = {}
  if (invite && inviteProfileId) {
    const name = await findMahadProfileNameById(inviteProfileId)
    if (name) {
      const lastSpace = name.lastIndexOf(' ')
      inviteProps = {
        inviteToken: invite,
        initialFirstName: lastSpace > 0 ? name.slice(0, lastSpace) : name,
        initialLastName: lastSpace > 0 ? name.slice(lastSpace + 1) : '',
      }
    }
  }
  return (
    <>
      <MahadPageHeader ... />
      <RegisterForm {...inviteProps} />
    </>
  )
}
```

(Keep the existing header/JSX; only the props wiring is new. `export const dynamic = 'force-dynamic'` is already set.)

5. Form (`registration-form.tsx`):

```tsx
export function RegisterForm({
  inviteToken,
  initialFirstName,
  initialLastName,
}: {
  inviteToken?: string
  initialFirstName?: string
  initialLastName?: string
} = {}) {
```

- default values: spread `MAHAD_DEFAULT_FORM_VALUES` then override `firstName: initialFirstName ?? ''`, `lastName: initialLastName ?? ''`, `inviteToken`.
- ensure the submit payload includes `inviteToken` (it is part of form values via defaultValues; no visible field is rendered for it).

- [ ] **Step 4: Run to verify pass**

Run: `bunx vitest run "app/mahad/(forms)/register/_actions/__tests__/index.test.ts"`
Expected: all pass. Then `bunx tsc --noEmit` and `bunx vitest run lib/services/mahad/__tests__/registration-service.test.ts` (regression).

- [ ] **Step 5: Commit**

```bash
git add lib/registration/schemas/mahad-registration.ts "app/mahad/(forms)/register/_actions/index.ts" "app/mahad/(forms)/register/page.tsx" "app/mahad/(forms)/register/_components/registration-form.tsx" lib/db/queries/program-profile.ts "app/mahad/(forms)/register/_actions/__tests__/index.test.ts"
git commit -m "feat(mahad): invite-aware registration form and action"
```

---

### Task 5: Invite link generator script + full verification

**Files:**

- Create: `scripts/generate-mahad-invite-links.ts`

**Interfaces:**

- Consumes: `createInviteToken` (Task 1).

- [ ] **Step 1: Write the script**

```ts
import { prisma } from '@/lib/db'
import { createInviteToken } from '@/lib/utils/invite-token'

import { runScript } from './lib/run-script'

async function main() {
  if (process.env.NODE_ENV !== 'production') {
    console.error('ERROR: set NODE_ENV=production to generate live links.')
    process.exit(1)
  }
  if (!process.env.MAHAD_INVITE_SECRET) {
    console.error('ERROR: MAHAD_INVITE_SECRET is not set.')
    process.exit(1)
  }
  const baseUrl = process.env.BASE_URL ?? 'https://irshadcenter.com'

  const profiles = await prisma.programProfile.findMany({
    where: {
      program: 'MAHAD_PROGRAM',
      person: { email: null, phone: null },
    },
    select: { id: true, person: { select: { name: true } } },
    orderBy: { person: { name: 'asc' } },
  })

  for (const p of profiles) {
    const token = createInviteToken(p.id)
    console.log(
      `${p.person.name}\t${baseUrl}/mahad/register?invite=${encodeURIComponent(token)}`
    )
  }
  console.log(`\n${profiles.length} invite links generated`)
}

runScript(main, { cleanup: () => prisma.$disconnect() })
```

(`console.log` is the delivery mechanism here, as in the other `scripts/` tools; the CI console lint applies to production code, not `scripts/`.)

- [ ] **Step 2: Verify it compiles and guards**

Run: `bunx tsc --noEmit`
Run: `bunx tsx scripts/generate-mahad-invite-links.ts` (without NODE_ENV)
Expected: exits 1 with the NODE_ENV error — proves the guard without touching prod.

- [ ] **Step 3: Full verification**

Run: `bun run test`
Expected: entire suite green.
Run: `bunx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-mahad-invite-links.ts
git commit -m "feat(mahad): invite link generator for recovery outreach"
```
