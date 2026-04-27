# Teacher Attendance System — Design Document

PR #224 · Branch: `claude/phase-2-attendance-design-Ox7wJ`
50 files, +5042 lines · 8 migrations · 4 new services + tests

---

## 1. Problem Statement

Before this PR, the only attendance data for Dugsi teachers came from a GPS check-in kiosk — teachers clock in/out on an iPad. The system could tell you who showed up, but not who didn't. There was no way to:

- See which teachers were absent (no record = invisible)
- Track school closures (snow days, holidays)
- Let teachers request excuses for late arrivals or absences
- Give admins a grid view of attendance across all teachers and dates
- Automatically mark teachers as late when they don't check in

This PR adds all of that.

---

## 2. State Machine

### 2.1 The Six States

Every (teacher, date, shift) tuple gets a `TeacherAttendanceRecord` with one of these statuses:

| Status     | Meaning                                                       | Color in UI          |
| ---------- | ------------------------------------------------------------- | -------------------- |
| `EXPECTED` | Slot generated, teacher hasn't done anything yet              | Gray                 |
| `PRESENT`  | Teacher clocked in on time (self or admin)                    | Green                |
| `LATE`     | Teacher clocked in after the deadline, or auto-marked by cron | Orange               |
| `ABSENT`   | Teacher never showed up (admin-only assignment)               | Red                  |
| `EXCUSED`  | Admin approved a teacher's excuse request                     | Blue                 |
| `CLOSED`   | School was closed that day                                    | Slate, strikethrough |

### 2.2 Actor-Aware Transition Policy

**File:** `lib/utils/attendance-transitions.ts`

Three separate policy tables enforce who can do what. A single union table is intentionally avoided — it would over-permit at every call site.

**Teacher (self-checkin):**

```
EXPECTED -> PRESENT, LATE
LATE     -> PRESENT, LATE  (update clockInTime on auto-marked record)
ABSENT   -> PRESENT, LATE  (only when source != ADMIN_OVERRIDE)
```

`canTeacherTransition(from, fromSource, to)` — provenance-aware. An `ADMIN_OVERRIDE`-sourced ABSENT record cannot be reversed by self-checkin regardless of target status.

**Admin (override dialog, adminCheckIn, deleteCheckin, excuse approval):**

```
EXPECTED -> PRESENT, LATE, ABSENT        (CLOSED excluded — system-only path)
PRESENT  -> ABSENT, LATE
LATE     -> ABSENT, EXCUSED, PRESENT, LATE
ABSENT   -> LATE, EXCUSED, PRESENT
EXCUSED  -> LATE, ABSENT
CLOSED   -> PRESENT
```

`assertAdminTransition(from, to)` — throws `ActionError(INVALID_TRANSITION, 422)` on violations.

**System (closure propagation, excuse approval):**

```
closure_mark:   EXPECTED -> CLOSED
excuse_approval: LATE    -> EXCUSED
                 ABSENT  -> EXCUSED
```

`assertSystemTransition(from, to, action)` — callers name the system intent explicitly via `SystemAction = 'closure_mark' | 'excuse_approval'`.

**AUTO_MARKED LATE → CLOSED bypass:** When an admin marks a date closed _after_ the cron has already auto-marked some teachers LATE, `markDateClosed()` performs this transition directly with `updateMany WHERE status='LATE' AND source='AUTO_MARKED'`. This is the **only code path** that does this — excluded from all policy tables because the override dialog must never close a teacher who physically showed up (`SELF_CHECKIN LATE`). Documented in `school-closure-service.ts:68-71`.

### 2.3 Non-Obvious Transition Decisions

**LATE → LATE (self-update):** When the cron auto-marks a teacher LATE (`source: AUTO_MARKED`), the teacher can still clock in after the deadline. Self-checkin updates `clockInTime`, `minutesLate`, and `source` to `SELF_CHECKIN` but keeps status `LATE`. The LATE→LATE transition allows this.

**CLOSED → PRESENT (not CLOSED → EXPECTED):** An admin can confirm a teacher physically showed up on a closed day. `CLOSED → EXPECTED` is banned because it would leave the record EXPECTED while the SchoolClosure row still exists — a contradictory state. Use `removeClosure()` to atomically revert whole-day closures.

**EXCUSED → LATE/ABSENT (with auto-rejection):** When an admin reverts an EXCUSED record, the service atomically rejects any APPROVED ExcuseRequest in the same transaction. Without this the teacher hits a dead-end: the old APPROVED row blocks a new submission and there's no admin UI to reject an already-approved request.

### 2.4 Source Tracking

Every record tracks how it reached its current status via `AttendanceSource`:

| Source            | Meaning                              |
| ----------------- | ------------------------------------ |
| `SELF_CHECKIN`    | Teacher used the GPS kiosk           |
| `ADMIN_OVERRIDE`  | Admin changed it manually            |
| `AUTO_MARKED`     | Cron job marked it                   |
| `SYSTEM`          | Slot generation, closure propagation |
| `EXCUSE_APPROVED` | Admin approved an excuse request     |

`AttendanceStatusBadge` uses source to render contextual labels: "Late (auto)" for `AUTO_MARKED`, "Excused (approved)" for `EXCUSE_APPROVED`, and "+Nm" with `minutesLate` for self-checkin late records.

### 2.5 Optimistic Locking

Every status write uses `updateMany` with the current status in the `WHERE` clause:

```sql
UPDATE "TeacherAttendanceRecord"
SET status = 'EXCUSED', source = 'EXCUSE_APPROVED', ...
WHERE id = $1 AND status = 'LATE'  -- optimistic lock
```

If a concurrent admin override already changed the status, `count = 0` and the service throws `CONCURRENT_MODIFICATION` (409).

---

## 3. Database Schema

### 3.1 New Tables

**TeacherAttendanceRecord** — the core table.

```
id            UUID PK
teacherId     FK -> Teacher
date          DATE
shift         MORNING | AFTERNOON
status        TeacherAttendanceStatus (default: EXPECTED)
previousStatus TeacherAttendanceStatus? (saved before closure for restore)
source        AttendanceSource (default: SYSTEM)
checkInId     FK -> DugsiTeacherCheckIn (unique, one-to-one)
clockInTime   TIMESTAMP (denormalized for display without join)
minutesLate   INT (null when not LATE)  ← CHECK constraint enforced
notes         TEXT
changedBy     TEXT (admin actor for audit)
createdAt     TIMESTAMP
updatedAt     TIMESTAMP

UNIQUE(teacherId, date, shift)
INDEX(teacherId, date)
INDEX(date, shift, status)   -- covers auto-mark and grid queries
```

**SchoolClosure** — one row per closed date.

```
id        UUID PK
date      DATE (UNIQUE)
reason    TEXT
createdBy TEXT
createdAt TIMESTAMP
updatedAt TIMESTAMP
```

**ExcuseRequest** — teacher excuse submissions + admin review.

```
id                   UUID PK
attendanceRecordId   FK -> TeacherAttendanceRecord
teacherId            FK -> Teacher (denormalized for fast lookups)
reason               TEXT (min 10 chars)
status               PENDING | APPROVED | REJECTED
adminNote            TEXT
reviewedBy           TEXT
reviewedAt           TIMESTAMP
createdAt            TIMESTAMP
updatedAt            TIMESTAMP

INDEX(status)
INDEX(attendanceRecordId)
INDEX(teacherId, status)
```

**DugsiAttendanceConfig** — singleton row for auto-mark timing.

```
id                        TEXT PK (always "singleton")
morningAutoMarkMinutes    INT (default: 15)
afternoonAutoMarkMinutes  INT (default: 15)
updatedAt                 TIMESTAMP
updatedBy                 TEXT
```

### 3.2 Key Constraints and Indexes

**`minutesLate` CHECK constraint (migration `20260414000000`):**

```sql
ALTER TABLE "TeacherAttendanceRecord"
  ADD CONSTRAINT "attendance_minutes_late_only_when_late"
  CHECK ((status = 'LATE') OR "minutesLate" IS NULL);
```

Enforces that `minutesLate` is only set when status is LATE. The migration first clears stale values on non-LATE rows (safe: those values are definitionally wrong). Prisma doesn't surface this in the schema DSL — a `///` comment on the field documents the constraint exists.

**`previousStatus` constraint (deferred):** A blanket `SET previousStatus = 'EXPECTED'` on legacy CLOSED rows would invent history. The app-layer fallback in `reopenClosedRecords()` handles null via `restoreStatus ?? 'EXPECTED'` (school-closure-service.ts:171). A DB constraint requires reconstructing truth from `DugsiTeacherCheckIn` audit data first — deferred to a follow-up migration.

**Partial unique index on ExcuseRequest:**

```sql
CREATE UNIQUE INDEX "ExcuseRequest_attendanceRecordId_active_uniq"
  ON "ExcuseRequest"("attendanceRecordId")
  WHERE status IN ('PENDING', 'APPROVED');
```

DB-level guard against duplicate excuse submissions. Two concurrent `submitExcuse` calls can both pass the app-level `getExistingActiveExcuse` check (READ COMMITTED), but the second INSERT throws P2002, caught outside the transaction and mapped to `ALREADY_EXCUSED`.

**Trigger for teacher ID consistency:**

```sql
CREATE TRIGGER "ExcuseRequest_teacherId_check"
BEFORE INSERT OR UPDATE ON "ExcuseRequest"
FOR EACH ROW EXECUTE FUNCTION excuse_request_check_teacher_matches();
```

`ExcuseRequest.teacherId` is denormalized. The trigger ensures it always matches `TeacherAttendanceRecord.teacherId` — catches any direct INSERT with a mismatched teacherId.

**FK from TeacherAttendanceRecord.checkInId → DugsiTeacherCheckIn:**

Uses `onDelete: Restrict`. The service layer nulls `checkInId` before deleting a check-in. If a code path skips this, the FK violation is caught rather than silently orphaning the attendance record.

### 3.3 minutesLate Derivation — Centralized Helper

`lib/utils/attendance-state.ts` exports `deriveMinutesLate({ toStatus, clockInTimeUtc?, shift?, source? })`:

- Non-LATE status → always null
- LATE + `source: 'AUTO_MARKED'` → null (cron fires hours after class; offset is meaningless)
- LATE + missing clockInTime or shift → null
- LATE + valid inputs → computed from deadline delta via `evaluateCheckIn`

All 9 write sites across 5 service files use this helper. The AUTO_MARKED null case is a first-class API parameter, not a bypass comment.

### 3.4 Singleton Config Pattern

`getAttendanceConfig()` uses find-then-create with P2002 catch:

1. `findUnique({ where: { id: 'singleton' } })` — fast path
2. On `null` → `create` the default row
3. On P2002 (two concurrent first-access callers) → `findUniqueOrThrow`

Requires `PrismaClient` (not `DatabaseClient`) — catching P2002 inside a transaction would run queries on an already-aborted PostgreSQL connection.

---

## 4. Cron Automation

### 4.1 Schedule

Vercel Cron runs the auto-mark route once per day at **21:00 UTC** on weekends only:

```json
{ "path": "/api/cron/auto-mark", "schedule": "0 21 * * 0,6" }
```

21:00 UTC = 3:00 PM CST / 4:00 PM CDT — after both shifts have ended.

### 4.2 What the Cron Does

For each shift (morning and afternoon), in an independent transaction:

1. **Closure guard** — if a `SchoolClosure` exists for today, skip. Inside the transaction to prevent race with concurrent `markDateClosed`.

2. **Slot generation** — `createMany` with `skipDuplicates` creates EXPECTED records for every active teacher's assigned shifts. One `INSERT ... ON CONFLICT DO NOTHING` round-trip.

3. **Auto-mark** — `updateMany WHERE date=$d AND shift=$s AND status='EXPECTED'` flips remaining EXPECTED → LATE with `source: AUTO_MARKED` and `minutesLate: null`.

### 4.3 Why minutesLate is null for auto-marked records

The cron fires at 21:00 UTC. Computing `now - classStart` would produce ~360 min for morning, ~90 min for afternoon — reflecting when the cron ran, not when the teacher was actually late. `deriveMinutesLate({ toStatus: 'LATE', source: 'AUTO_MARKED' })` returns null explicitly. `AttendanceStatusBadge` renders "Late (auto)" to distinguish these from self-checkin records.

### 4.4 Threshold Configuration

Auto-mark threshold configurable per shift via admin settings:

- **Morning:** 0–120 minutes after 9:00 AM class start (default: 15)
- **Afternoon:** 0–89 minutes after 1:30 PM class start (default: 15)

Afternoon max of 89 derived from cron schedule: cron fires at 3:00 PM CST, class starts at 1:30 PM CST, so max = 89 minutes.

### 4.5 Why Each Shift Gets Its Own Transaction

`autoMarkBothShifts` uses `Promise.allSettled`. If the afternoon shift fails, the morning shift's committed results are preserved. Cron returns HTTP 207 (Multi-Status) on partial failure — Vercel treats any 2xx as success.

### 4.6 Authentication

Route validates `CRON_SECRET` using timing-safe comparison (both sides hashed to fixed-length digests before `crypto.timingSafeEqual`). If `CRON_SECRET` is unset, returns 401 immediately.

---

## 5. School Closures

### 5.1 Creating a Closure (`markDateClosed`)

Inside a single `$transaction`:

1. Check for existing closure (idempotency guard)
2. Create `SchoolClosure` row
3. `bulkTransitionStatus` flips all EXPECTED → CLOSED (saves `previousStatus: 'EXPECTED'`)
4. Auto-reject PENDING/APPROVED excuse requests on `AUTO_MARKED LATE` records
5. Direct `updateMany` flips `AUTO_MARKED LATE → CLOSED` (transition table bypass, see §2.2)

P2002 on `SchoolClosure.date` (two admins racing) caught outside the transaction → 409.

### 5.2 Removing a Closure (`removeClosure`)

Inside a single `$transaction`:

1. Verify closure exists
2. Delete `SchoolClosure` row
3. Auto-reject lingering PENDING/APPROVED excuse requests on CLOSED records
4. `reopenClosedRecords` reverts all CLOSED → `previousStatus` (or EXPECTED if null)

**Known trade-off:** Auto-marked LATE records that were closed will revert to EXPECTED, not LATE — the cron won't re-mark them automatically. Service emits `CLOSURE_REOPEN_MANUAL_REVIEW_NEEDED` warning log; closures UI shows an admin banner to review the grid.

---

## 6. Teacher Excuse Flow

### 6.1 Eligibility

Only LATE or ABSENT records can have excuse requests. Validated inside a transaction.

### 6.2 Submission (`submitExcuse`)

Inside a `$transaction`:

1. Fetch record status
2. Ownership check: `record.teacherId !== teacherId` → 403
3. Status check: must be LATE or ABSENT
4. Duplicate check: `getExistingActiveExcuse`
5. Create ExcuseRequest with status PENDING

P2002 on partial unique index (concurrent duplicate) caught outside transaction → `ALREADY_EXCUSED`.

### 6.3 Approval (`approveExcuse`)

Inside a `$transaction`:

1. Fetch excuse request, verify PENDING
2. Fetch current attendance record status
3. `assertAdminTransition` validates the LATE/ABSENT → EXCUSED transition
4. `updateMany` on ExcuseRequest with status PENDING in WHERE (optimistic lock)
5. `updateMany` on TeacherAttendanceRecord with current status in WHERE (optimistic lock)

Either count=0 → `CONCURRENT_MODIFICATION` (409), rolls back entire transaction.

### 6.4 Rejection (`rejectExcuse`)

Same transaction pattern, only updates ExcuseRequest. Optimistic locking prevents silent overwrite of concurrent approvals.

### 6.5 Auth Boundaries

Teacher identity is client-controlled — teachers select their name from a dropdown. The `teacherId` in excuse submissions is client-provided. The ownership check proves self-consistency, not true identity.

Phase 2 history/excuse features (`getTeacherAttendanceHistory`, `submitExcuseAction`) are gated by `PHASE2_EXCUSE_ENABLED`. Session token minting (`createTeacherSessionAction`) is guarded by the same flag in `checkin-form.tsx` — tokens are not minted when Phase 2 is disabled. OTP identity verification is required before enabling in production (follow-up: PR #225).

---

## 7. Teacher UX Flow

### 7.1 Check-In Page (`/teacher/checkin`)

The teacher selects their name, then:

1. **Clock In** — requires GPS within geofence. Creates `DugsiTeacherCheckIn` fact-log and transitions attendance record to PRESENT or LATE.
2. **Clock Out** — records departure time on existing check-in.
3. **Attendance History** — collapsible, loads on-demand (gated by `PHASE2_EXCUSE_ENABLED`). State managed by `useTeacherHistory` hook (race prevention via `currentTeacherRef`).
4. **Request Excuse** — inline form on LATE or ABSENT rows. Min 10 chars. Shows "Excuse pending review" / "Previous excuse rejected".

### 7.2 UI Hook Decomposition

- `useTeacherHistory` (`hooks/use-teacher-history.ts`) — owns all history state: loading, error, isOpen, excuseOpenId, race-prevention ref. Component becomes a pure render function.
- `useClockInOut` (`hooks/use-clock-in-out.ts`) — owns isPending and clock-in/out handlers with location validation guard.

---

## 8. Admin UX Flow

### 8.1 Teachers Dashboard (`/admin/dugsi/teachers`)

Tab-based layout: Teachers, Check-ins, Late Report, Excuses (new). Excuse queue is server-fetched, passed as `initialRequests` props to the `ExcuseQueue` client component.

### 8.2 Attendance Grid (`/admin/dugsi/teachers/attendance`)

Server Component page showing all teachers × last 8 weekends × both shifts. Teachers with no records in the window appear with "—" cells (seeded from full active roster, not just existing records).

Grid is capped at 1000 rows (`take: 1001`, slice to 1000, check `rows.length > 1000`). When truncated, a yellow banner appears above the grid: "Showing 1,000 of more records — narrow the date range to see all results."

Clicking any cell opens the **Status Override Dialog**: shows current status, allowed transitions via `getAdminAllowedTransitions(currentStatus)` (structurally excludes CLOSED since it's not in the admin table), optional notes, Save button. Calls `overrideAttendanceStatusAction` → `transitionStatus` with `assertAdminTransition` + optimistic lock.

### 8.3 School Closures (`/admin/dugsi/teachers/closures`)

Server Component page. Date input validates to weekends only (Zod). On add, optimistically appends a row while `router.refresh()` fetches real data. Remove shows `AlertDialog` warning that CLOSED records will revert.

### 8.4 Attendance Settings (`/admin/dugsi/teachers/settings`)

Singleton `DugsiAttendanceConfig` as a form. Changes take effect on the next cron run.

---

## 9. Architecture Layers

### 9.1 Layer Separation

```
Page (Server Component)
  -> fetches data via query functions
  -> passes to Client Component as props

Client Component
  -> calls server action on user interaction

Server Action (safe-action client)
  -> validates input with Zod schema
  -> calls service function
  -> revalidates cache with after()

Service (lib/services/dugsi/)
  -> business logic, transactions, transition guards
  -> calls query functions (never raw Prisma)

Query (lib/db/queries/teacher-attendance.ts)
  -> all Prisma queries, accepts DatabaseClient for tx participation
```

### 9.2 Transaction Composability

Every query function and service accepts `client: DatabaseClient = prisma`. When called standalone, uses the global Prisma client. When called inside a `$transaction`, the caller passes the tx client. `isPrismaClient(client)` determines whether to wrap in a new transaction or execute directly.

### 9.3 Error Handling

Domain errors use `ActionError(message, ERROR_CODES.X, undefined, httpStatus)`. P2002/P2025 Prisma errors always caught **outside** the transaction (PostgreSQL aborts the tx on constraint violations).

---

## 10. File Map

| File                                                             | Purpose                                                               |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| `lib/utils/attendance-transitions.ts`                            | Actor-aware transition policies (teacher, admin, system)              |
| `lib/utils/attendance-state.ts`                                  | `deriveMinutesLate` — centralized minutesLate derivation              |
| `lib/utils/date-utils.ts`                                        | Shared `getWeekendDatesBetween` utility                               |
| `lib/constants/attendance-status.ts`                             | Status display config (labels, colors)                                |
| `lib/constants/shift-times.ts`                                   | School timezone, shift start times, class start times                 |
| `lib/validations/teacher-attendance.ts`                          | All Zod schemas for attendance inputs                                 |
| `lib/db/queries/teacher-attendance.ts`                           | All query functions (records, closures, config, excuses)              |
| `lib/services/dugsi/attendance-record-service.ts`                | Slot generation, status transitions, admin check-in, bulk transitions |
| `lib/services/dugsi/auto-mark-service.ts`                        | Cron logic: per-shift auto-mark + both-shifts orchestrator            |
| `lib/services/dugsi/excuse-service.ts`                           | Submit, approve, reject excuse requests                               |
| `lib/services/dugsi/school-closure-service.ts`                   | Create/remove closures with attendance propagation                    |
| `lib/services/dugsi/teacher-checkin-service.ts`                  | Clock-in/out with dual-write to attendance record                     |
| `app/api/cron/auto-mark/route.ts`                                | Vercel Cron endpoint with CRON_SECRET auth                            |
| `app/admin/dugsi/teachers/attendance/actions.ts`                 | All admin attendance server actions                                   |
| `app/admin/dugsi/teachers/attendance/page.tsx`                   | Attendance grid page (Server Component)                               |
| `app/admin/dugsi/teachers/attendance/components/`                | Grid, badge, override dialog                                          |
| `app/admin/dugsi/teachers/closures/page.tsx`                     | Closures management page (Server Component)                           |
| `app/admin/dugsi/teachers/settings/page.tsx`                     | Auto-mark settings page (Server Component)                            |
| `app/admin/dugsi/teachers/components/excuse-queue.tsx`           | Pending excuse review queue                                           |
| `app/teacher/checkin/actions.ts`                                 | Teacher-facing actions (clock-in/out, history, excuse)                |
| `app/teacher/checkin/hooks/use-teacher-history.ts`               | History state + race-prevention ref                                   |
| `app/teacher/checkin/hooks/use-clock-in-out.ts`                  | Clock-in/out handlers with location guard                             |
| `app/teacher/checkin/components/checkin-history.tsx`             | Collapsible attendance history (consumes useTeacherHistory)           |
| `app/teacher/checkin/components/excuse-form.tsx`                 | Inline excuse submission form                                         |
| `prisma/schema.prisma`                                           | 4 new models, 3 enums                                                 |
| `prisma/migrations/20260409*`                                    | Initial tables                                                        |
| `prisma/migrations/20260410*`                                    | Indexes, constraints, trigger, FK change                              |
| `prisma/migrations/20260414000000_attendance_minutes_late_check` | minutesLate CHECK constraint                                          |

---

## 11. Known Limitations and Follow-ups

| Item                                               | Status                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| Teacher identity is client-controlled (no session) | Gated by `PHASE2_EXCUSE_ENABLED`; OTP required (PR #225)                      |
| `previousStatus` DB constraint not yet enforced    | App-layer fallback in place; needs audit data reconstruction first            |
| `clockInTime` sync with DugsiTeacherCheckIn        | Comment-enforced; a DB trigger would require cross-table reads on every write |
| Admin grid lacks cursor pagination                 | 1000-row cap with truncation banner; ~31 teachers at 2 shifts × 16 dates      |
| No real-time updates on excuse queue               | Manual refresh button added                                                   |
| Hobby plan: cron limited to once daily             | Both shifts processed in single invocation                                    |
