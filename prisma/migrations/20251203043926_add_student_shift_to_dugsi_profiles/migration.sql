-- CreateEnum
CREATE TYPE "StudentShift" AS ENUM ('MORNING', 'AFTERNOON');

-- AlterTable
ALTER TABLE "ProgramProfile" ADD COLUMN     "shift" "StudentShift";

-- CreateIndex
CREATE INDEX "ProgramProfile_program_shift_idx" ON "ProgramProfile"("program", "shift");
