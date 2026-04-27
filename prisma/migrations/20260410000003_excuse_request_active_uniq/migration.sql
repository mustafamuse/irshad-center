-- Partial unique index to prevent duplicate active excuse requests for the same attendance record.
-- Prisma doesn't support partial unique indexes natively, so this is a raw migration.
--
-- Without this index, two concurrent submitExcuse calls can both pass the
-- getExistingActiveExcuse check (READ COMMITTED snapshot) and both insert a PENDING row.
-- The index makes the second insert throw P2002, which submitExcuse catches and maps
-- to ALREADY_EXCUSED, turning the in-code check into a fast-path guard rather than
-- the only line of defence.
CREATE UNIQUE INDEX "ExcuseRequest_attendanceRecordId_active_uniq"
  ON "ExcuseRequest"("attendanceRecordId")
  WHERE status IN ('PENDING', 'APPROVED');
