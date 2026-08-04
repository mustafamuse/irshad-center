# Mahad registration: recovery-profile matching (invite links + name fallback)

Status: approved 2026-08-03
Scope: Mahad only. Supports the 2026-08 billing-recovery outreach.

## Problem

The 2026-08-03 recovery session created 16 thin Mahad profiles (13 from the
attendance roster plus Asia Yussuf, Muna Yusuf, Abdiwahab Haibah) whose
Person rows have name only — no email, no phone. `registerMahadStudent`
deduplicates on email/phone via `DuplicateDetectionService.checkDuplicate`,
so when these families register through the public form, every submission
creates a duplicate Person + ProgramProfile + Enrollment beside the thin
one. For already-billed students (Asia), billing would point at the thin
profile while registration data lands on the duplicate.

Outreach is a mix of personal texts per family and one generic link
(user decision), and name matches auto-merge (user decision).

## Design

Two complementary entry paths into one enrichment code path.

### 1. Invite links (personal texts)

- URL: `/mahad/register?invite=<token>`.
- Token: `<profileId>.<sig>` where `sig` is hex HMAC-SHA256 of the
  profileId using new env var `MAHAD_INVITE_SECRET`, truncated to 32 hex
  chars. No expiry: the token stops being useful once the profile is
  enriched (a second submit hits the normal email/phone duplicate 409).
- New module `lib/utils/invite-token.ts`: `createInviteToken(profileId)`,
  `verifyInviteToken(token): string | null` (returns profileId; null on
  bad format/signature; timing-safe compare).
- Registration page (server component): when `invite` verifies, fetch the
  profile's person name and prefill the name fields (the form uses
  firstName/lastName; split the stored name on the last space for
  display only — binding is by token, not by the typed name; fields stay
  editable). Invalid token renders the normal
  blank form (no error banner; the family just registers normally).
- Action: `registerMahadStudent` action schema gains optional
  `inviteToken: z.string().max(200)`. The action verifies it and passes
  `inviteProfileId` to the service. Invalid token at submit time → treated
  as absent (fall through to normal flow), never an error.

### 2. Name fallback (generic link)

Inside the service transaction, only when `checkDuplicate` finds no
existing person by email/phone: look up Persons where
`name` equals input name (case-insensitive), `email IS NULL`,
`phone IS NULL`, and a MAHAD_PROGRAM profile exists — the signature of a
recovery-created record (real registrations always carry contact info
because `mahadRegistrationSchema` requires email and phone — verified
2026-08-03).

- Exactly 1 match → merge into it (same enrichment path as invites).
- 0 or 2+ matches → create fresh, exactly as today.

### 3. Enrichment path (shared)

Given a target profileId (from invite) or person match (from fallback),
inside the existing `$transaction`:

- Person: fill null fields only — email, phone, dateOfBirth (same
  conservative-merge rule the service already uses). Never overwrite.
  Name is never changed (existing rule).
- ProgramProfile: fill null fields only — gradeLevel, schoolName,
  graduationStatus, paymentFrequency, billingType. `paymentNotes`:
  append the submitted note (if any) after the recovery marker rather
  than overwriting. `monthlyRate` is not set here (unchanged from
  current behavior; rate assignment happens at billing setup).
- Enrollment: if the profile has an active enrollment (`endDate: null`),
  do NOT create a second one; update its `batchId` only when the
  submission picked a batch and it differs. If no active enrollment,
  create one (current behavior).
- Return `{ profileId }` of the enriched profile.

Guard: an invite token whose profile no longer exists, or whose profile
is not MAHAD_PROGRAM, falls through to the normal flow. An invite for a
person who already has email set still enriches (fills remaining nulls);
if the submitted email/phone collides with a DIFFERENT person, the
existing unique-constraint/duplicate handling applies unchanged (409).

### 4. Link generator script

`scripts/generate-mahad-invite-links.ts` (committed, reusable):
prints `name<TAB>url` for every MAHAD profile whose person has
`email IS NULL AND phone IS NULL`, using `MAHAD_INVITE_SECRET` and a
`BASE_URL` env (default `https://irshadcenter.com`). Read-only; follows
`runScript` conventions and the NODE_ENV=production guard used by other
scripts in `scripts/`.

## Error handling

| Case                                                | Behavior                                     |
| --------------------------------------------------- | -------------------------------------------- |
| Invalid/garbled invite token (page or submit)       | normal blank-form flow, no error             |
| Invite profile deleted or non-Mahad                 | normal flow                                  |
| Email/phone already registered (active profile)     | existing 409 DUPLICATE_CONTACT, unchanged    |
| Name fallback finds 2+ candidates                   | create fresh (no merge)                      |
| Submitted email/phone belongs to a different person | existing P2002/duplicate handling, unchanged |

## Testing (TDD)

Existing suites: `lib/services/mahad/__tests__/registration-service.test.ts`,
`app/mahad/(forms)/register/_actions/__tests__/index.test.ts` — extend, do
not rewrite.

- invite-token: round-trip verify; tampered signature → null; malformed →
  null.
- service, invite path: enriches person nulls + profile nulls; keeps
  existing enrollment (no second row); updates batchId only on change;
  never overwrites non-null fields; returns the enriched profileId.
- service, fallback path: exactly-one contact-less name match merges;
  zero matches creates fresh; two matches creates fresh; a person WITH
  contact info is never fallback-matched even on name equality.
- service, guards: dead/non-Mahad invite falls through; duplicate email
  409 unchanged with an invite present.
- action: schema accepts absent/present token; invalid token at submit
  falls through (no error).

## Out of scope

- Dugsi (its registration has family semantics; no recovery gap there).
- Admin merge tooling for duplicates that predate this change.
- Billing/rate assignment at registration (unchanged).
- Invite-link revocation or expiry.
