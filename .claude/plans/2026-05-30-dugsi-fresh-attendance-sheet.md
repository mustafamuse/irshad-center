# Plan: Generate a fresh Dugsi attendance workbook from the database

**Status:** SCOPED — not implemented. Follow-up to PR #237.
**Supersedes:** `2026-05-30-dugsi-sheet-name-correction.md` (in-place editing — abandoned
in favor of generating a clean new sheet, which is a CREATE with no concurrency/clobber risk).

## Goal

Generate a brand-new Google Spreadsheet, **one tab per active class+shift**, each tab
named after the teacher and pre-filled with that class's enrolled students in canonical
DB spelling — a blank attendance template using the same column layout as the current
sheet. The existing sheet stays as the historical record; teachers move to the clean one.

## Why this over editing the live sheet

The current sheet is hand-typed (drifted spellings) and actively edited by teachers.
Patching cells in place races their edits and risks data loss (Drive scope = delete
authority). Generating fresh from the DB is a CREATE: reads the source of truth, writes a
new file, touches nothing existing, fully reversible (delete the new file). It also bakes
in the new teacher-named classes and accurate rosters in one pass.

## Decisions (confirmed with owner 2026-05-30)

- **Content:** blank attendance template — correct rosters + the same column headers as
  the current sheet, with attendance marks left empty.
- **Timing:** run AFTER the 6 pending registrations exist (so the new students appear).
- **Tabs:** one tab per class+shift (mirrors the DB exactly), named `<Teacher> (AM|PM)`.

## Tabs to generate (from active DugsiClass + DugsiClassEnrollment)

| Tab title | DB class / shift | Roster source |
|---|---|---|
| Mustafa Awil (AM) | Mustafa Awil / MORNING | active enrollments |
| Mustafa Awil (PM) | Mustafa Awil / AFTERNOON | active enrollments |
| Mohamed Ali-Daar (AM) | Mohamed Ali-Daar / MORNING | active enrollments |
| Mohamed Ali-Daar (PM) | Mohamed Ali-Daar / AFTERNOON | active enrollments |
| Abdiwahab Haibah (AM) | Abdiwahab Haibah / MORNING | active enrollments |
| Ducale Matan (AM) | Ducale Matan / MORNING | active enrollments |
| Suraya Mohamed (PM) | Suraya Mohamed / AFTERNOON | active enrollments |

Counts must match the DB at run time (today: 31/7/20/18/22/23/11 = 132, plus the 6 new
registrations once applied).

**Islamic Studies (Hamza Hassan)** is an OPEN ITEM: it's a cross-class overlay with 0
`DugsiClassEnrollment` rows (its attendees are enrolled in their regular class), so its
roster is NOT derivable from the DB. Either skip this tab, or populate it from the old
sheet's Islamic Studies list — decide before building.

## Approach

1. **Read DB** (read-only): for each active class, pull enrolled students (canonical
   `Person.name`), sorted (alphabetical unless owner prefers by age).
2. **Mirror column layout**: read ONE existing tab's header row from the current sheet
   (read-only) to replicate the familiar columns (Name, P, Juz Category, Lesson, Behavior,
   Overall, plus any date columns left blank). Header only — no marks copied.
3. **Create the workbook**: Sheets API `spreadsheets.create` (titled e.g. "Dugsi
   Attendance YYYY-YYYY"), then `batchUpdate` to add the tabs, then `values.update` to
   write each tab's header row + roster into column A. Token via `python3 $GWS_AUTH`.
4. **Report**: print the new spreadsheet URL + per-tab roster counts for verification.

## Guards / safety

- DB access is read-only (SELECT only). Source sheet is read-only (header template only).
- This CREATES a new file; it never overwrites the existing sheet.
- **Dry-run by default**: print the planned tabs + per-tab roster (names + counts) with no
  API write; require `--apply` to actually create the workbook.
- Per gsuite-tools, creating a Drive file is confirmation-required — `--apply` is that gate.
- Re-running `--apply` creates ANOTHER new file (no silent overwrite); the owner deletes
  extras. (Optional later: write to a configured target sheet ID and clear+rewrite tabs.)
- Sharing/permissions on the new file are handled by the owner (out of scope).

## Acceptance criteria (verifiable)

1. Dry-run lists the 7 class tabs (+ the Islamic Studies decision) with per-tab roster
   names and counts that match active `DugsiClassEnrollment` per class.
2. `--apply` creates exactly one new spreadsheet containing those tabs; prints its URL.
3. Each tab's column A holds that class's canonical roster (matches DB count + names,
   including the 6 newly-registered students); attendance columns are blank.
4. Header row matches the current sheet's column layout.
5. The original sheet is unchanged (verified: only read, never written).
6. Spot-check 2 tabs in the created sheet against the DB rosters.

## Verification commands

```bash
# dry-run: planned tabs + rosters, no write
GOOGLE_ACCESS_TOKEN=$(python3 $GWS_AUTH) \
  bunx tsx --env-file=.env.local scripts/generate-dugsi-attendance-sheet.ts
# create the workbook
GOOGLE_ACCESS_TOKEN=$(python3 $GWS_AUTH) \
  bunx tsx --env-file=.env.local scripts/generate-dugsi-attendance-sheet.ts --apply
# open the printed URL and spot-check 2 tabs vs the DB
```

## Open decisions before implementing

- Islamic Studies tab: skip, or seed from the old sheet's IS list?
- Roster sort order: alphabetical vs by age vs by shift-then-name.
- Workbook title + whether date columns should be pre-seeded (e.g. term start) or blank.
- Who the new sheet is shared with (owner handles, or script attempts a share?).
- After adoption: archive/rename the old sheet so there's a single source going forward.
```
