/*
  Warnings:

  - A unique constraint covering the columns `[batchId,subjectId]` on the table `ClassSchedule` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Semester` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ClassSchedule_batchId_subjectId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "ClassSchedule_batchId_subjectId_key" ON "ClassSchedule"("batchId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Semester_name_key" ON "Semester"("name");
