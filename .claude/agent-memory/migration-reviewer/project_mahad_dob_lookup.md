---
name: mahad-dob-lookup
description: mahad-lookup worktree adds an unauthenticated DOB-range lookup over Person; the +/-26h window is deliberate, not a bug
metadata:
  type: project
---

The `mahad-lookup` worktree (branch `fix/scripts-hardening` as of 2026-08-01) adds a public, unauthenticated Mahad status lookup. `findMahadProfilesByDob` in `lib/db/queries/mahad-verification.ts` queries `programProfile` filtered on nested `person.dateOfBirth` with a **+/-26 hour range**, capped by `DOB_CANDIDATE_CAP`, then narrows by normalized name.

**Why:** stored and submitted DOBs are both local-midnight instants (`new Date(y, m-1, d)`), so the same calendar day can differ by up to 26h between a UTC-12 and a UTC+14 device. The window is intentional and documented in the function's docstring — do not "fix" it into an equality match or a UTC-day extraction.

**How to apply:** this is why `Person.dateOfBirth` needs a standalone `@@index` — the existing `@@index([name, dateOfBirth])` cannot serve a range on its second column when the query has no name predicate at the SQL level. If a future migration proposes dropping `Person_dateOfBirth_idx` as "redundant with the composite," that reasoning is wrong for this access path. Person is small (hundreds to low thousands of rows), so the planner may still seq-scan today; the index is cheap insurance on an endpoint that takes unauthenticated traffic.

Related: [[migration-apply-flow]]
