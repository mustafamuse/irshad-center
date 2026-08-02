---
name: mahad-public-lookup-accepted-risk
description: PR #229 /mahad/check public unauthenticated lookup — which disclosure risks the owner already accepted, and what remains open
metadata:
  type: project
---

PR #229 ships a PUBLIC, unauthenticated status lookup at `/mahad/check` (email OR name+DOB).
The owner has **explicitly accepted** single-factor email lookup as a product tradeoff, conditioned on
"rate-limited via Upstash, confirmed present in prod".

**Why:** Mahad students have no accounts/passwords; the alternative (WhatsApp back-and-forth with the
admin for every status question) does not scale for a solo operator.

**How to apply:** In future reviews of `app/mahad/(forms)/check/**`,
`lib/services/mahad/verification-service.ts`, `lib/db/queries/mahad-verification.ts` — do NOT re-litigate
"this should require auth". DO flag regressions against the premise:

- anything that weakens or bypasses the rate limiter (fail-open paths, missing `maxAttempts`,
  duplicate cheaper oracles like `checkEmailExists` in the register action)
- responses that grow beyond `firstName` / `status` / `registeredAt` / `profileId`
- the `profileId` (ProgramProfile UUID PK) doubling as a bearer capability for `/mahad/check/[id]`
  and `/mahad/register/success/[id]` — those pages take no second factor.

Related: [[feedback-accepted-risk-scope]] (if written).
