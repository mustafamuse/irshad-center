# Dugsi Export Hardening — Plan

**Branch**: `dugsi-export-hardening`
**Worktree**: `.claude/worktrees/dugsi-export-hardening`
**Base**: `origin/main` @ `726b5bfa` (post-#233)
**Author**: Planner (Opus, feature-gan stage 1)
**Date**: 2026-05-28

---

## Goal

Make the Dugsi parent-contact vCard export correct, auditable, and consistent with the Mahad export. Fix three real bugs (contact-normalization bypass, kid-loss on global dedupe, parent2-with-no-name silently dropped), wire the dead `Family` metadata into a usable `includeChurned` filter (default `false`), split the `skipped` counter, add structured logging, and add shift scoping — all without UI changes beyond the toast string.

---

## Acceptance criteria (verifiable)

1. `bun run test` is clean — all existing 28 `vcard-export.test.ts` cases pass plus new ones below.
2. `bun run typecheck` is clean.
3. `bun run build` succeeds (parity with current main).
4. **Contact normalization**: two registrations with parent phones `(612) 555-1234` and `6125551234` group into the same family (new vitest case).
5. **Cross-family kid merge**: when the same normalized contact appears as primary parent in two families, the export emits **one** vCard whose `NOTE` lists children from **both** families (new vitest case).
6. **Parent2 with no name**: a parent2 with phone but no first/last name is exported with `FN: "Dugsi Parent"` (new vitest case).
7. **Skipped counts split**: action returns `{ exported, skippedNoContact, skippedDuplicate }`. The legacy `skipped` field is removed from `VCardResult`. Mahad action also returns the split shape (with `skippedDuplicate: 0`).
8. **`includeChurned` filter**: default `false`. Families with a canceled subscription AND no active subscription are excluded. Mixed-status families (one canceled + one active) remain. Passing `includeChurned: true` restores current behavior.
9. **Shift scoping**: passing `shift: 'MORNING'` exports only morning families; filename becomes `dugsi-morning-parent-contacts-YYYY-MM-DD.vcf`; vCard `ORG` becomes `Dugsi - MORNING`. With no shift: `dugsi-parent-contacts-YYYY-MM-DD.vcf` and `ORG: Irshad Dugsi`.
10. **Structured log**: dugsi action emits exactly one `logger.info` call with fields `{ exported, skippedNoContact, skippedDuplicate, totalFamilies, includeChurned, shift }` (verified via a spy in vitest). Mahad action emits the equivalent with `{ exported, skippedNoContact, skippedDuplicate, batchId }`.
11. **Toast string**: dashboard headers display `"Exported N parent contacts (X no-contact, Y duplicates skipped)"` when either skip bucket is > 0, else `"Exported N parent contacts"`.
12. **No edits in high-risk paths** (`lib/services/shared/billing.ts`, `lib/services/webhooks/**`, `lib/stripe/**`, `prisma/**`, `lib/safe-action.ts`, `app/api/webhook/**`, `middleware.ts`).
13. **No new dependencies**. No schema migration.

---

## Decisions (Planner-resolved, with rationale)

### Finding #2 — global vs per-family dedupe → **Merge kids across families**
Confirmed by user. The vCard exists to give the admin a phone-book of *people*, not a record of *registration rows*. A parent with kids in two registration entries is one human; their contact card should list every child of theirs.

Implementation: build `familyMap` first (already done); then build a `contactMap: Map<dedupeKey, VCardContact>` keyed by `normalizeEmail(email) ?? normalizePhone(phone)`. When the same key is seen again, append the new family's child names to the existing contact's `NOTE`. The "duplicate" case for `skippedDuplicate` then only fires when the *exact same family-parent pair* is re-encountered (which currently can't happen, so `skippedDuplicate` is reserved for a future case where parent1 == parent2 within one family).

Actually — refine: `skippedDuplicate++` when the same dedupe key is seen across parent1 and parent2 of the **same family** (a co-parent sharing contact info, common in shared-phone households). That's a real outcome the admin should see.

### Finding #4 — dead `Family` metadata → **Wire up as `includeChurned`, default `false`**
Confirmed by user. Filter is applied **before** `addParent` loop. Semantic: `excludeWhen = !includeChurned && family.hasChurned && !family.hasSubscription`. Mixed-status families (still-paying + canceled) stay in. Pure-churned families drop out. The `parentEmail` / `parentPhone` fields on `Family` remain unused locally — we'll stop populating them in this action's local construction to keep the code lean; the shared `Family` type stays untouched because other consumers may use it.

### Finding #3 — Mahad scope → **Update both actions in this PR**
Confirmed by user. `VCardResult` shape changes once. Both actions and all three consumers (`dashboard-header.tsx` × 2, `batch-grid.tsx`) update in lock-step. No backwards-compat shim — full break, single PR.

### Finding #7 — UI scope → **Server-only, dropdown in follow-up**
Confirmed by user. Action accepts optional `shift`; dashboard-header keeps its current single button (calls action with empty input). Follow-up PR adds the shift selector.

### Finding #9 — email normalization in storage
**Decision**: normalize emails before storing in `VCardContact.email`. Lowercased + trimmed via `normalizeEmail()`. The vCard standard is case-insensitive for the EMAIL field anyway; this kills the inconsistency without breaking any consumer.

---

## File-by-file changes

### Modified

#### 1. `lib/vcard-export.ts`
- **`VCardResult` interface** (lines 11–16): replace `skipped: number` with `skippedNoContact: number` and `skippedDuplicate: number`. No other helper changes.
- No changes to `escapeVCardValue`, `formatPhoneForVCard`, `generateVCard`, `getDateString`, `generateVCardsContent`.

#### 2. `app/admin/dugsi/actions.ts`
- **Imports** (lines 74–80, 33–59): add `normalizeEmail`, `normalizePhone` from `@/lib/utils/contact-normalization`. Add `z` is already imported (line 7). Add `logInfo` is already imported (line 31) — use the existing `logger` instance.
- **`_generateDugsiVCardContent`** (lines 244–346): full rewrite of the action body. Specifically:
  - Add `.schema(z.object({ shift: z.enum(['MORNING', 'AFTERNOON']).optional(), includeChurned: z.boolean().default(false) }))`.
  - Action body receives `{ parsedInput: { shift, includeChurned } }`.
  - Pass `shift` into `getAllDugsiRegistrations(undefined, shift ? { shift } : undefined)`.
  - Replace family-key construction to use normalized contact:
    ```ts
    const key =
      reg.familyReferenceId ||
      normalizeEmail(reg.parentEmail) ||
      normalizePhone(reg.parentPhone) ||
      reg.id
    ```
  - Stop computing dead `Family` metadata locally; only compute `hasChurned` and `hasSubscription` (now used by filter). Skip the `parentEmail`/`parentPhone` local fields.
  - Apply `includeChurned` filter on families before contact build.
  - Replace the `seen: Set<string>` dedupe with a `contactMap: Map<string, VCardContact>` that **merges children into existing contact's NOTE** when a duplicate key is hit *across families*; increments `skippedDuplicate` only when the duplicate appears *within the same family*.
  - Fix parent2 guard: drop the outer name guard; let `addParent` handle name-fallback to `'Dugsi Parent'`.
  - In `addParent`, normalize email/phone before storing on the `VCardContact` (use `normalizeEmail(email)` for storage; phone already goes through `formatPhoneForVCard`).
  - Compute filename: `dugsi-${shift?.toLowerCase()}-parent-contacts-${getDateString()}.vcf` when shift set, else `dugsi-parent-contacts-${getDateString()}.vcf`. Note: current code says `dugsi-parent-contacts-…` already — keeping that base spelling.
  - Compute `ORG`: `Dugsi - ${shift}` when shift set, else `Irshad Dugsi`. Pass through to each contact built in `addParent`.
  - Emit exactly one `logger.info({ exported, skippedNoContact, skippedDuplicate, totalFamilies: families.length, includeChurned, shift }, 'Dugsi contacts exported')` before returning.
  - Return `{ content, filename, exported, skippedNoContact, skippedDuplicate }`.
- **Exported wrapper** (lines 1197–1200): no signature change — the wrapper forwards positional args, and `Parameters<typeof _generateDugsiVCardContent>` adapts automatically.

#### 3. `app/admin/dugsi/components/dashboard/dashboard-header.tsx`
- Line 27: change call to `generateDugsiVCardContent({})`.
- Lines 33–49: destructure `{ content, filename, exported, skippedNoContact, skippedDuplicate }`. Build toast text:
  ```ts
  const totalSkipped = skippedNoContact + skippedDuplicate
  const msg = totalSkipped > 0
    ? `Exported ${exported} parent contacts (${skippedNoContact} no-contact, ${skippedDuplicate} duplicates skipped)`
    : `Exported ${exported} parent contacts`
  ```

#### 4. `app/admin/mahad/_actions/vcard-actions.ts`
- Imports: add `createServiceLogger`. (Module-level `const logger = createServiceLogger('mahad-admin-actions')` at top.)
- Action body: rename `skipped` local → `skippedNoContact`. Add `skippedDuplicate = 0` (always 0 for Mahad — flat row data, no dedupe). Emit `logger.info({ exported, skippedNoContact, skippedDuplicate, batchId }, 'Mahad contacts exported')` before return. Update return shape.

#### 5. `app/admin/mahad/components/dashboard/dashboard-header.tsx`
- Mirror dugsi-header toast change. Same message format.

#### 6. `app/admin/mahad/components/batches/batch-grid.tsx`
- Same toast change on the batch-scoped export call. Pull `skippedNoContact + skippedDuplicate`.

### Created

#### 7. `app/admin/dugsi/__tests__/vcard-action.test.ts` *(new)*
Vitest module. Mocks: `@/lib/services/dugsi` → `getAllDugsiRegistrations`; `@/lib/logger` → spy on the service logger.

Cases (each maps to an acceptance criterion):
- `groups two registrations with differently-formatted parent phones into one family` (AC #4)
- `same parent across two families produces one vCard with merged children in NOTE` (AC #5)
- `parent2 with phone but no name is exported with "Dugsi Parent" fallback` (AC #6)
- `returns split skip counts: no-contact bucket and duplicate bucket` (AC #7)
- `excludes churned-only families by default (includeChurned: false)` (AC #8)
- `includes churned families when includeChurned: true`
- `keeps mixed-status families when includeChurned: false` (active sub + canceled sub on different members)
- `shift filter applies to family selection`
- `filename includes shift when scoped`
- `ORG includes shift when scoped`
- `emits logger.info with the documented structured fields` (AC #10)
- `parent1 and parent2 sharing a phone within the same family increments skippedDuplicate by 1`

#### 8. `app/admin/mahad/__tests__/vcard-action.test.ts` *(new)*
Smaller. Confirms:
- Return shape has `skippedNoContact` and `skippedDuplicate: 0`.
- `logger.info` emitted with `{ exported, skippedNoContact, skippedDuplicate, batchId }`.

### Not modified — explicit non-touches

- `lib/vcard-client.ts` — unchanged.
- `lib/__tests__/vcard-export.test.ts` — unchanged; only the type definition moves, helpers stay identical.
- `app/admin/dugsi/_types/index.ts` — shared `Family` type stays untouched (other consumers may use the fields).
- `lib/services/dugsi/registration-service.ts` — `getAllDugsiRegistrations` already supports `shift`; we just pass it through.

---

## High-risk paths invoked

**None.** This feature is confined to admin actions, UI components, vCard helpers, and tests. Explicitly does not touch any high-risk path. No specialty agent (security-reviewer, migration-reviewer) required. `verify-app` recommended in Stage 3 for UI smoke.

---

## Verification commands (Evaluator runs these)

```bash
# from worktree root
cd /Users/mustafamuse/dev/irshad-center/.claude/worktrees/dugsi-export-hardening

# 1. Type check
bun run typecheck

# 2. Targeted tests first
bun run test lib/__tests__/vcard-export.test.ts
bun run test app/admin/dugsi/__tests__/vcard-action.test.ts
bun run test app/admin/mahad/__tests__/vcard-action.test.ts

# 3. Full test suite (no regressions)
bun run test

# 4. Production build parity
bun run build

# 5. Confirm no high-risk paths touched
git diff --name-only origin/main | grep -E '^(lib/services/shared/billing\.ts|lib/services/webhooks/|lib/stripe/|prisma/|lib/safe-action\.ts|app/api/webhook/|middleware\.ts)$' && echo "VIOLATION" || echo "clean"

# 6. UI smoke (Evaluator stage 3 — bun dev + manual export click)
bun run dev
# then in browser: /admin/dugsi → click Export Contacts → confirm toast + .vcf download
# then: /admin/mahad → same
```

---

## Out of scope (explicit punts)

- **Shift selector UI** in dugsi dashboard header (action accepts `shift` server-side; UI follow-up).
- **`includeChurned` toggle UI** (action accepts it; admin must call with `{includeChurned: true}` from a future UI).
- **Mahad shift parity** — Mahad doesn't have shifts; no analogous filter to add.
- **`unstable_cache` on the export query** — exports want fresh data; staying uncached is correct.
- **Migration of `Family` type** — shared type stays. Local construction stops populating unused fields, but the type definition is left alone for other consumers.
- **Toast i18n** — toast is English-only, matching existing project state.

---

## Failures (populated by Stage 2 if any per-file verification fails)

*(empty — Generator fills as it goes)*

---

## Notes for Generator

- The action file `app/admin/dugsi/actions.ts` is ~1200 lines. **Touch only the `_generateDugsiVCardContent` action block (lines 244–346) and its imports.** Do not refactor adjacent code, do not reorder imports beyond adding what's needed.
- The action exports a positional wrapper at line 1197. Leave the wrapper signature untouched — `Parameters<typeof _action>` will adapt to the new zod-schema-derived input automatically.
- For the contact-merge logic: iterate `families.flatMap(family => parents-from-family)` once. Each iteration calls a helper that either inserts into `contactMap` or appends children to the existing entry's NOTE (`existing.note = "Children: <old>, <new family kids>"`). Be careful about NOTE-string deduping if the same child name somehow appears twice — split on `, `, dedupe via `Set`, re-join.
- Mahad action change is minimal — don't accidentally remove `batchId` zod schema or batch-name-based filename logic.
- Logger calls must use structured fields object as the first arg (Pino convention), not template literals. Per repo logging conventions.
- Tests should mock at the **module boundary** (`vi.mock('@/lib/services/dugsi', ...)`), not deeper. The existing project pattern is to mock service exports, not Prisma directly, for action tests.
