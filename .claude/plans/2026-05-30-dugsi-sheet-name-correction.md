# Plan: Correct student name spellings in the Google attendance sheet

**Status:** SUPERSEDED by `2026-05-30-dugsi-fresh-attendance-sheet.md`. The owner chose to
generate a fresh workbook from the DB (a CREATE, no concurrency/clobber risk) rather than
edit the live sheet's cells in place. Kept for context; do NOT implement the in-place writer.
**Direction:** DB canonical name → Google Sheet (the reverse of reconciliation).

## Goal

For every attendance-sheet name that is a confident match to a DB student but is
spelled differently, overwrite the sheet's column-A cell with the DB's canonical
name — so the teachers' tabs use accurate, consistent spellings that line up with
the database.

## Why

The database name is the source of truth for spelling (confirmed at registration);
the sheet is hand-typed and drifts (Suhayla/Suheila, Muhumed/Mohomed, Shiekhali/
Shiekh Ali, Adan Gelle/Adan Ogle). Fixing the sheet makes future reconciliations
cleaner (fewer review flags) and gives teachers correct names.

## Source of corrections (already computed)

`scripts/data/dugsi-reconciliation-report.json` pairs each sheet name to its DB
match. A correction candidate is any pair where:
- it is a **confident** match — `matched` (auto: exact/high/medium) OR a
  `CONFIRMED_ALIASES` entry, AND
- `normalizeName(sheetName) !== normalizeName(dbName)` (spelling actually differs).

Explicitly EXCLUDED (never auto-write):
- `needsReview` (low confidence / unresolved),
- `inSheetNotInDb` (no DB record — new/unknown students),
- pairs already spelled identically.

Known candidates (from the confirmed set): Suhayla Ali→Suheila Ali, Affifa
Shimoyali→Affifa Shimoye, Walid Muhumed→Walid Mohomed, Warda Muhumed→Warda
Mohomed, Mohamed-Amin→Mohamedamin Mohamed, Ismail Sheikhali→Ismail Shiekh Ali,
Adan Gelle→Adan Ogle, Adil→Adil Shimoye, Mohamed Mohamed→Mohammad Mohammad. (Plus
any auto-matched near-spellings the report surfaces at run time.)

## The hard part: precise cell targeting

The current snapshot (`RosterTab { tab, students: string[] }`) has **no row
numbers**, so we cannot safely address a cell. Two-part fix:

1. **Enhanced fetch** — extend `fetch-dugsi-attendance-roster.ts` (or a sibling)
   to capture `{ tab, row, name }` per student (1-based sheet row, header-aware),
   not just the name. This is the addressing key for the write.
2. **Match by (tab, row)** — resolve each correction to an exact `tab!A{row}`
   cell. If a tab has the same sheet name in multiple rows, require the row to be
   unambiguous or skip + flag (never guess which duplicate to rewrite).

## Approach (two phases; phase 2 is opt-in)

**Phase 1 — review-ready correction list (no writes).**
A read-only script that joins the enhanced fetch with the reconcile report and
emits `scripts/data/dugsi-sheet-name-corrections.{md,json}`: every proposed cell
change as `tab!A{row}: "current" → "canonical"  (confidence, dbProfileId)`. This
is the artifact the owner reviews. Covers 100% of the value with zero risk.

**Phase 2 — guarded writer (opt-in, explicit confirmation).**
A script that applies the Phase-1 list to the live sheet:
- **Snapshot/back up first**: write the current full column-A values per tab to a
  timestamped `scripts/data/dugsi-sheet-backup-<ts>.json` so every write is
  reversible.
- **Dry-run by default**: print every intended cell change; require `--apply`.
- **Idempotent**: skip a cell already equal to the canonical name.
- **Re-read-before-write guard**: immediately before writing, re-fetch each target
  cell and confirm its current value still equals the expected "old" value; if it
  changed (a teacher edited the sheet), SKIP + flag rather than clobber.
- **Batch write** via the Sheets API `values.batchUpdate` (token from
  `python3 $GWS_AUTH`), only column A, only the resolved rows.

## High-risk surface (external write)

This writes to a live Google Sheet teachers actively use — not the DB. Per the
gsuite-tools skill: external writes are **confirmation-required**; the Drive scope
also grants delete authority, so the writer must touch ONLY column A of ONLY the
resolved rows. Reversibility is the backup snapshot. No schema/DB/Stripe impact.

## Acceptance criteria (verifiable)

1. Phase 1 lists every confident spelling-difference as `tab!A{row}: old → new`
   and lists ZERO `needsReview`/`inSheetNotInDb` names.
2. Each correction resolves to exactly one cell; ambiguous duplicate-name rows are
   reported as skipped, not written.
3. Phase 2 dry-run prints the same changes; `--apply` writes only those cells.
4. A backup snapshot of pre-write column-A values exists before any write.
5. Re-running Phase 2 after an apply is a no-op (idempotent).
6. The re-read guard skips (does not overwrite) any cell whose live value drifted
   from the expected old value.
7. Spot-check 3 corrected cells in the sheet; attendance data in those rows is
   unchanged (only column A edited).

## Verification commands

```bash
# Phase 1 (read-only): produce the correction list
GOOGLE_ACCESS_TOKEN=$(python3 $GWS_AUTH) \
  bunx tsx --env-file=.env.local scripts/plan-dugsi-sheet-corrections.ts
# review scripts/data/dugsi-sheet-name-corrections.md

# Phase 2 (guarded): dry-run then apply
GOOGLE_ACCESS_TOKEN=$(python3 $GWS_AUTH) \
  bunx tsx --env-file=.env.local scripts/apply-dugsi-sheet-corrections.ts          # dry-run + backup
GOOGLE_ACCESS_TOKEN=$(python3 $GWS_AUTH) \
  bunx tsx --env-file=.env.local scripts/apply-dugsi-sheet-corrections.ts --apply
# re-run dry-run → expect 0 changes (idempotent)
```

## Open decisions before implementing

- Confirm DB spelling is authoritative for EVERY pair, or hand-approve the Phase-1
  list before any write (recommended: approve the list).
- Pending registrations (Ehsan/Abdirahim/Abdullahi Ismail, Umeyr Somane, Amira/
  Ammaar Yussuf): their sheet names can only be corrected AFTER they exist in the
  DB and an alias/match is established — run this after registration.
- Whether to also normalize the Islamic Studies tab names (overlay) or only the
  primary class tabs.
- Timing: coordinate so teachers aren't mid-editing during a Phase-2 apply.
```
