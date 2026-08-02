-- Reconciliation: DugsiClassTeacher exists in production but no migration in the
-- repo ever created it (the original CREATE TABLE was applied from a branch whose
-- migration files were lost). The two 20260403 migrations index/alter this table,
-- so this file is timestamped just before them to make fresh-database replay work.
-- The teacherId+isActive index is intentionally omitted here: 20260403000000
-- creates it, and 20260403000001's DROP INDEX IF EXISTS is a safe no-op.
-- This migration is marked applied in production via `prisma migrate resolve`
-- and never executes there.

-- CreateTable
CREATE TABLE "DugsiClassTeacher" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DugsiClassTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DugsiClassTeacher_classId_idx" ON "DugsiClassTeacher"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "DugsiClassTeacher_classId_teacherId_key" ON "DugsiClassTeacher"("classId", "teacherId");

-- AddForeignKey
ALTER TABLE "DugsiClassTeacher" ADD CONSTRAINT "DugsiClassTeacher_classId_fkey" FOREIGN KEY ("classId") REFERENCES "DugsiClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DugsiClassTeacher" ADD CONSTRAINT "DugsiClassTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
