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

### 2.2 Transition Table

**File:** `lib/utils/attendance-transitions.ts`

```
EXPECTED  -> PRESENT, LATE, ABSENT, CLOSED
PRESENT   -> ABSENT, EXCUSED, LATE
LATE      -> ABSENT, EXCUSED, PRESENT, LATE (self-update)
ABSENT    -> LATE, EXCUSED, PRESENT
EXCUSED   -> LATE, ABSENT
CLOSED    -> PRESENT
```

This table is the **single source of truth**. Every status change — whether from a teacher's clock-in, an admin override, the cron job, or the excuse flow — is validated against it before writing. The validation function `assertValidTransition(from, to)` throws `ActionError` with code `INVALID_TRANSITION` on illegal moves.

### 2.3 Non-Obvious Transition Decisions

#### EXPECTED -> ABSENT (direct)

An admin reviewing the grid for a past weekend can mark a teacher who never showed up directly as `ABSENT` from `EXPECTED`. There's no requirement to go through `LATE` first.

#### LATE -> LATE (self-update)

When the cron auto-marks a teacher as `LATE` (`source: AUTO_MARKED`), the teacher can still clock in after the deadline. This self-check-in updates `clockInTime`, `minutesLate`, and `source` to `SELF_CHECKIN` but keeps the status as `LATE`. The LATE->LATE transition allows this without the transition guard rejecting it.

#### CLOSED -> PRESENT (but not CLOSED -> EXPECTED)

An admin can confirm a teacher physically showed up on a closed day. This makes the attendance grid render a green PRESENT cell on a strikethrough date header — conveying "teacher showed up on a day the school was closed." The admin check-in intentionally leaves the `SchoolClosure` row in place.

`CLOSED -> EXPECTED` is banned because it would leave the record in `EXPECTED` while the `SchoolClosure` row still exists — a contradictory state. To revert a whole day's closure, use `removeClosure()` which atomically deletes the `SchoolClosure` row and reverts all `CLOSED` records.

#### AUTO_MARKED LATE -> CLOSED (transition table bypass)

When an admin marks a date as closed _after_ the cron has already auto-marked some teachers `LATE`, those auto-marked records need to flip to `CLOSED`. But the transition table intentionally doesn't include `LATE -> CLOSED` because:

- The override dialog should never let an admin close a teacher who physically showed up (`SELF_CHECKIN LATE`)
- Only system-generated `LATE` records (`source: AUTO_MARKED`) should be closed

The `markDateClosed()` function performs this transition directly with `updateMany WHERE status='LATE' AND source='AUTO_MARKED'` — it's the **only code path** that does this. The comment in `school-closure-service.ts:68-71` documents why.

#### EXCUSED -> LATE/ABSENT (with auto-rejection of excuse)

When an admin reverts an `EXCUSED` record back to `LATE` or `ABSENT`, the service atomically rejects any `APPROVED` `ExcuseRequest` in the same transaction. Without this, the teacher would hit a dead-end: they couldn't submit a new excuse (the old APPROVED row would block it via the partial unique index) and there's no admin UI to reject an already-approved request.

### 2.4 Source Tracking

Every record tracks _how_ it reached its current status via `AttendanceSource`:

| Source            | Meaning                                        |
| ----------------- | ---------------------------------------------- |
| `SELF_CHECKIN`    | Teacher used the GPS kiosk                     |
| `ADMIN_OVERRIDE`  | Admin changed it manually                      |
| `AUTO_MARKED`     | Cron job marked it                             |
| `SYSTEM`          | Slot generation, closure propagation, backfill |
| `EXCUSE_APPROVED` | Admin approved an excuse request               |

The `AttendanceStatusBadge` component uses source to render contextual labels: "Late (auto)" for `AUTO_MARKED`, "Excused (approved)" for `EXCUSE_APPROVED`, and "+Nm" with the `minutesLate` value for self-check-in late records.

### 2.5 Optimistic Locking

Every status write uses `updateMany` with the current status in the `WHERE` clause:

```sql
UPDATE "TeacherAttendanceRecord"
SET status = 'EXCUSED', source = 'EXCUSE_APPROVED', ...
WHERE id = $1 AND status = 'LATE'  -- optimistic lock
```

If a concurrent admin override already changed the status, `count = 0` and the service throws `CONCURRENT_MODIFICATION` (409). This prevents two admins from silently overwriting each other.

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
source        AttendanceSource (default: SYSTEM)
checkInId     FK -> DugsiTeacherCheckIn (unique, one-to-one)
clockInTime   TIMESTAMP (denormalized for display without join)
minutesLate   INT (null when not LATE)
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

**Partial unique index on ExcuseRequest:**

```sql
CREATE UNIQUE INDEX "ExcuseRequest_attendanceRecordId_active_uniq"
  ON "ExcuseRequest"("attendanceRecordId")
  WHERE status IN ('PENDING', 'APPROVED');
```

This is the DB-level concurrency guard against duplicate excuse submissions. Two concurrent `submitExcuse` calls can both pass the application-level `getExistingActiveExcuse` check (READ COMMITTED snapshot), but the second `INSERT` will throw P2002, which the service catches outside the transaction and maps to `ALREADY_EXCUSED`. Prisma doesn't support partial unique indexes natively, so this is a raw SQL migration.

**Trigger for teacher ID consistency:**

```sql
CREATE TRIGGER "ExcuseRequest_teacherId_check"
BEFORE INSERT OR UPDATE ON "ExcuseRequest"
FOR EACH ROW EXECUTE FUNCTION excuse_request_check_teacher_matches();
```

`ExcuseRequest.teacherId` is denormalized (it duplicates `TeacherAttendanceRecord.teacherId`). The trigger ensures they always match at the DB level, catching any direct INSERT with a mismatched teacherId — a safety net beyond the service-layer validation.

**FK from TeacherAttendanceRecord.checkInId -> DugsiTeacherCheckIn:**

Uses `onDelete: Restrict` (not `SetNull`). The service layer nulls `checkInId` before deleting a check-in. If a code path skips this, the FK violation is caught rather than silently orphaning the attendance record.

### 3.3 Singleton Config Pattern

`getAttendanceConfig()` uses a find-then-create pattern with P2002 catch:

1. `findUnique({ where: { id: 'singleton' } })` — fast path, returns on ~every call
2. On `null` (first-ever access) → `create` the default row
3. On P2002 (two concurrent first-access callers) → `findUniqueOrThrow` to read the row the winner created

The function requires `PrismaClient` (not `DatabaseClient`) because the P2002 catch is only safe outside a transaction — PostgreSQL aborts the transaction on constraint violations. This is enforced at the type level: passing a `TransactionClient` produces a compile-time error.

---

## 4. Cron Automation

### 4.1 Schedule

Vercel Cron runs the auto-mark route once per day at **21:00 UTC** on weekends only:

```json
{ "path": "/api/cron/auto-mark", "schedule": "0 21 * * 0,6" }
```

21:00 UTC = 3:00 PM CST / 4:00 PM CDT — after both shifts have ended. The hobby plan only supports daily cron jobs, so both shifts are processed in a single invocation.

### 4.2 What the Cron Does

For each shift (morning and afternoon), in an independent transaction:

1. **Closure guard** — if a `SchoolClosure` exists for today, skip. This check is _inside_ the transaction to prevent a race with a concurrent `markDateClosed`.

2. **Slot generation** — `createMany` with `skipDuplicates` creates `EXPECTED` records for every active teacher's assigned shifts. Existing rows (any status) are left untouched. This is a single `INSERT ... ON CONFLICT DO NOTHING` — one round-trip regardless of roster size.

3. **Auto-mark** — `updateMany WHERE date=$d AND shift=$s AND status='EXPECTED'` flips remaining `EXPECTED` records to `LATE` with `source: AUTO_MARKED` and `minutesLate: null`.

### 4.3 Why minutesLate is null for auto-marked records

The cron fires at 21:00 UTC. Computing `now - classStart` would produce ~360 minutes for the morning shift and ~90 minutes for the afternoon. These numbers reflect when the _cron ran_, not when the teacher was actually late. The configured threshold (e.g. 15 minutes) reflects the _policy_, not actual lateness. `AttendanceStatusBadge` renders "Late (auto)" to distinguish these from self-check-in late records that have a real `minutesLate`.

### 4.4 Threshold Configuration

The auto-mark threshold is configurable per shift via the admin settings page:

- **Morning:** 0–120 minutes after 9:00 AM class start (default: 15)
- **Afternoon:** 0–89 minutes after 1:30 PM class start (default: 15)

The afternoon max of 89 is derived from the cron schedule: the cron fires at 3:00 PM CST, class starts at 1:30 PM CST, so max = (3:00 PM - 1:30 PM) - 1 minute = 89 minutes. Any higher value would mean the auto-mark window extends past the cron fire time, making the threshold meaningless.

### 4.5 Why Each Shift Gets Its Own Transaction

`autoMarkBothShifts` uses `Promise.allSettled`, not `Promise.all`. If the afternoon shift fails (e.g. a transient DB error), the morning shift's committed results are preserved. The cron returns HTTP 207 (Multi-Status) when one shift failed, which Vercel Cron treats as success (any 2xx) but surfaces the partial failure in monitoring dashboards.

### 4.6 Authentication

The route validates `CRON_SECRET` using timing-safe comparison:

```typescript
const expectedHash = crypto
  .createHash('sha256')
  .update(`Bearer ${cronSecret}`)
  .digest()
const receivedHash = crypto
  .createHash('sha256')
  .update(authHeader ?? '')
  .digest()
const valid = crypto.timingSafeEqual(expectedHash, receivedHash)
```

Both sides are hashed to fixed-length digests before comparison so `timingSafeEqual` is always called on equal-length inputs — no length short-circuit, and the expected token length is never leaked via timing. If `CRON_SECRET` is unset, the route returns 401 immediately without attempting comparison.

---

## 5. School Closures

### 5.1 Creating a Closure (`markDateClosed`)

Inside a single `$transaction`:

1. Check for existing closure (idempotency guard)
2. Create `SchoolClosure` row
3. `bulkTransitionStatus` flips all `EXPECTED -> CLOSED`
4. Auto-reject any PENDING/APPROVED excuse requests on `AUTO_MARKED LATE` records
5. Direct `updateMany` flips `AUTO_MARKED LATE -> CLOSED` (transition table bypass)

P2002 on the `SchoolClosure.date` unique constraint (two admins racing) is caught **outside** the transaction and remapped to a 409.

### 5.2 Removing a Closure (`removeClosure`)

Inside a single `$transaction`:

1. Verify closure exists
2. Delete `SchoolClosure` row
3. Auto-reject any lingering PENDING/APPROVED excuse requests on `CLOSED` records
4. `updateMany` reverts all `CLOSED -> EXPECTED`

**Known trade-off:** This reverts ALL `CLOSED` records indiscriminately — including records that were `AUTO_MARKED LATE` before the closure. Since the cron only runs for today's date, historical records will remain `EXPECTED` and never be re-marked `LATE` automatically. The service emits a `CLOSURE_REOPEN_MANUAL_REVIEW_NEEDED` warning log, and the closures UI shows a yellow banner telling the admin to review the attendance grid.

Future fix: add a `previousStatus` column to `TeacherAttendanceRecord` (populated by `markDateClosed`) so `removeClosure` can restore the original state.

---

## 6. Teacher Excuse Flow

### 6.1 Eligibility

Only `LATE` or `ABSENT` records can have excuse requests. The service validates this inside a transaction.

### 6.2 Submission (`submitExcuse`)

Inside a `$transaction`:

1. Fetch record status (slim `select: { id, teacherId, status }`)
2. Ownership check: `record.teacherId !== teacherId` -> 403
3. Status check: must be `LATE` or `ABSENT`
4. Duplicate check: `getExistingActiveExcuse` (fast-path guard)
5. Create `ExcuseRequest` with status `PENDING`

If the partial unique index catches a concurrent duplicate (P2002), it's caught **outside** the transaction and mapped to `ALREADY_EXCUSED`.

### 6.3 Approval (`approveExcuse`)

Inside a `$transaction`:

1. Fetch excuse request, verify `PENDING`
2. Fetch current attendance record status, verify transition is valid
3. `updateMany` on ExcuseRequest with status `PENDING` in WHERE (optimistic lock)
4. `updateMany` on TeacherAttendanceRecord with current status in WHERE (optimistic lock)

If either `updateMany` returns `count=0`, someone else got there first — throw `CONCURRENT_MODIFICATION` (409), which rolls back the entire transaction.

### 6.4 Rejection (`rejectExcuse`)

Same transaction pattern, but only updates the ExcuseRequest (no attendance record change). Also uses optimistic locking — if a concurrent approval already changed the status, the rejection fails cleanly.

### 6.5 Security Constraint

The teacher app has no session — teachers identify by selecting their name from a dropdown. The `teacherId` in excuse submissions is client-controlled. The ownership check (`record.teacherId !== teacherId`) only proves self-consistency, not true identity.

Both `getTeacherAttendanceHistory` and `submitExcuseAction` are gated behind `PHASE2_AUTH_ENABLED !== 'true'` — a runtime deploy guard that prevents production use until PR #225 adds signed session tokens.

---

## 7. Teacher UX Flow

### 7.1 Check-In Page (`/teacher/checkin`)

The teacher selects their name from a dropdown, then:

1. **Clock In** — requires GPS within the geofence. Creates a `DugsiTeacherCheckIn` fact-log row and transitions the attendance record from `EXPECTED` (or stays `LATE` if past the deadline) to `PRESENT` or `LATE`.

2. **Clock Out** — records the departure time on the existing check-in.

3. **Attendance History** — collapsible section showing the last 8 weekends. Each row shows date, shift, status badge, and clock-in time. Loads on-demand when expanded (calls `getTeacherAttendanceHistory` action behind the `PHASE2_AUTH_ENABLED` guard).

4. **Request Excuse** — inline form appears on `LATE` or `ABSENT` rows. Minimum 10 characters. Shows "Excuse pending review" for active requests, "Previous excuse rejected" for rejected ones (with a "Resubmit" link).

### 7.2 History Refresh After Excuse

`handleExcuseSuccess` calls `fetchHistory(teacherId)` directly — a function that unconditionally fetches, bypassing the `hasLoaded` guard that `loadHistory` uses. This ensures the UI immediately reflects the new pending excuse without requiring the teacher to close and reopen the section.

---

## 8. Admin UX Flow

### 8.1 Teachers Dashboard (`/admin/dugsi/teachers`)

Tab-based layout with four tabs:

- **Teachers** — roster management (existing)
- **Check-ins** — raw check-in data (existing)
- **Late Report** — aggregated late/absent data (existing)
- **Excuses** — pending excuse queue (new)

The excuse queue is server-fetched: the parent page calls `getPendingExcuseRequests()` and passes the data as `initialRequests` props to the `ExcuseQueue` client component. Each card shows teacher name, date, shift, original status, teacher's reason, a text area for admin notes, and Approve/Reject buttons. Error handling is per-row (one failing action doesn't break others).

### 8.2 Attendance Grid (`/admin/dugsi/teachers/attendance`)

A Server Component page that shows all teachers x last 8 weekends x both shifts in a table. Teachers are rows, weekend dates are column groups (AM/PM sub-columns). Cells show colored `AttendanceStatusBadge` components. Closed dates have strikethrough headers.

Teachers with no records in the window (new hires, etc.) still appear with "—" cells — the grid seeds from the full active roster, not just existing records.

Clicking any cell opens the **Status Override Dialog**: shows current status, allowed transitions (filtered to overrideable statuses: PRESENT, LATE, ABSENT, EXCUSED), optional notes field, and Save button. On save, calls `overrideAttendanceStatusAction` which runs `transitionStatus` with the transition table guard + optimistic lock.

### 8.3 School Closures (`/admin/dugsi/teachers/closures`)

Server Component page that lists existing closures (fetched server-side) and a form to add new ones. Date input validates to weekends only (Zod schema rejects weekdays). On add, optimistically appends a row with a temporary ID while `router.refresh()` fetches the real data. On remove, shows an `AlertDialog` confirmation warning that CLOSED records will revert to EXPECTED and auto-marked LATE records may need manual correction. Remove filter matches on date string (not ID) to avoid the optimistic ID / real ID desync.

### 8.4 Attendance Settings (`/admin/dugsi/teachers/settings`)

Server Component page displaying the singleton `DugsiAttendanceConfig` as a form with two number inputs: morning delay (0–120 min) and afternoon delay (0–89 min). Changes take effect on the next cron run.

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

Every query function and service accepts `client: DatabaseClient = prisma`. When called standalone, it uses the global Prisma client. When called inside a `$transaction`, the caller passes the transaction client. The `isPrismaClient(client)` guard determines whether to wrap in a new transaction or execute directly:

```typescript
return isPrismaClient(client) ? client.$transaction(doWrites) : doWrites(client)
```

### 9.3 Error Handling

Domain errors use `ActionError(message, ERROR_CODES.X, undefined, httpStatus)`. The safe-action `handleServerError` middleware catches these and serializes them to the client. P2002/P2025 Prisma errors are always caught **outside** the transaction (PostgreSQL aborts the tx on constraint violations — catching inside would run queries on a dead connection).

---

## 10. File Map

| File                                                   | Purpose                                                               |
| ------------------------------------------------------ | --------------------------------------------------------------------- |
| `lib/utils/attendance-transitions.ts`                  | Transition table + validators                                         |
| `lib/utils/date-utils.ts`                              | Shared `getWeekendDatesBetween` utility                               |
| `lib/constants/attendance-status.ts`                   | Status display config (labels, colors)                                |
| `lib/constants/shift-times.ts`                         | School timezone, shift start times, class start times                 |
| `lib/validations/teacher-attendance.ts`                | All Zod schemas for attendance inputs                                 |
| `lib/db/queries/teacher-attendance.ts`                 | All query functions (records, closures, config, excuses)              |
| `lib/services/dugsi/attendance-record-service.ts`      | Slot generation, status transitions, admin check-in, bulk transitions |
| `lib/services/dugsi/auto-mark-service.ts`              | Cron logic: per-shift auto-mark + both-shifts orchestrator            |
| `lib/services/dugsi/excuse-service.ts`                 | Submit, approve, reject excuse requests                               |
| `lib/services/dugsi/school-closure-service.ts`         | Create/remove closures with attendance propagation                    |
| `lib/services/dugsi/teacher-checkin-service.ts`        | Clock-in/out with dual-write to attendance record                     |
| `app/api/cron/auto-mark/route.ts`                      | Vercel Cron endpoint with CRON_SECRET auth                            |
| `app/admin/dugsi/teachers/attendance/actions.ts`       | All admin attendance server actions                                   |
| `app/admin/dugsi/teachers/attendance/page.tsx`         | Attendance grid page (Server Component)                               |
| `app/admin/dugsi/teachers/attendance/components/`      | Grid, badge, override dialog                                          |
| `app/admin/dugsi/teachers/closures/page.tsx`           | Closures management page (Server Component)                           |
| `app/admin/dugsi/teachers/closures/components/`        | Closures form + list                                                  |
| `app/admin/dugsi/teachers/settings/page.tsx`           | Auto-mark settings page (Server Component)                            |
| `app/admin/dugsi/teachers/components/excuse-queue.tsx` | Pending excuse review queue                                           |
| `app/teacher/checkin/actions.ts`                       | Teacher-facing actions (clock-in/out, history, excuse)                |
| `app/teacher/checkin/components/checkin-history.tsx`   | Collapsible attendance history                                        |
| `app/teacher/checkin/components/excuse-form.tsx`       | Inline excuse submission form                                         |
| `scripts/backfill-attendance.ts`                       | Historical record backfill from existing check-in data                |
| `prisma/schema.prisma`                                 | 4 new models, 3 enums                                                 |
| `prisma/migrations/20260409*`                          | Initial tables                                                        |
| `prisma/migrations/20260410*`                          | Indexes, constraints, trigger, FK change                              |

---

## 11. Known Limitations and Future Work

| Item                                               | Status                                       | Tracking                               |
| -------------------------------------------------- | -------------------------------------------- | -------------------------------------- |
| Teacher identity is client-controlled (no session) | Gated by `PHASE2_AUTH_ENABLED`               | PR #225                                |
| `removeClosure` loses pre-closure state            | Documented trade-off + admin warning         | Follow-up: add `previousStatus` column |
| No real-time updates on excuse queue               | Manual refresh button added                  | Consider polling or SSE                |
| Hobby plan: cron limited to once daily             | Both shifts processed in single invocation   | Upgrade to Pro for finer granularity   |
| No component tests for grid/dialog/form            | Service-layer tests cover all business logic | Follow-up                              |
| Backfill script is one-time                        | Idempotent via `skipDuplicates`              | Safe to re-run                         |
