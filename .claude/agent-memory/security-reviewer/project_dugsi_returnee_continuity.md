---
name: dugsi-returnee-guardian-continuity
description: Dugsi returnee re-registration — why cross-family reassignment of WITHDRAWN children is allowed, what guards it, and the accepted residual risk
metadata:
  type: project
---

Public Dugsi registration may reassign a **WITHDRAWN** child to a new `familyReferenceId`,
gated by a guardian-continuity second factor (`isBlockedFamilyReassignment` +
`findChildrenWithGuardianContinuity` in `lib/services/registration-service.ts`). Shipped 2026-08-04.

**Why:** every registration mints a fresh `familyReferenceId`, so a returnee family always
mismatches its old one — without the carve-out withdrawn families can never re-register.
Continuity is the second factor because the form matches children by name + DOB only.

**How to apply** when reviewing this area:

- The rule is enforced at **two** call sites — Phase 0 `validateFamilyConflicts` (fails before
  any writes; the flow is phased/non-transactional, so do NOT propose deleting it) and the
  in-loop guard (race-safety net). Both must route through the same helper + predicate.
  This drifted twice during review; a change to one without the other is a regression.
- Continuity counts **active rows only**. Withdrawal never deactivates `GuardianRelationship`;
  only the admin `removeGuardianRelationship` does. Counting inactive rows would let a
  deliberately removed guardian (custody/safeguarding) reclaim the child.
- **Accepted residual risk:** `/dugsi/register/success` is unauthenticated (middleware matches
  only `/admin/:path*`) and serializes child `dateOfBirth` plus parent email/phone for the 50
  most recent families into a client component. An attacker can scrape it, satisfy continuity
  with a victim parent's contact, and attach themselves as a second guardian. Owner filed this
  as an immediate follow-up ticket rather than blocking the branch. **Fixing that page is the
  real closure** — re-check whether it landed before accepting any further widening here.
- Primary-payer-only continuity was considered and **rejected as ineffective**: the attacker
  controls slot assignment (`primaryPayer: 'parent1'` with the victim's email). Do not re-propose.
  Only requiring continuity for _every_ submitted guardian would block the foothold, at the cost
  of breaking legitimate "add a second parent at re-registration".

Related: [[mahad-public-lookup-accepted-risk]] (same single-factor-lookup premise on the Mahad side).
