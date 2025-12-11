-- AlterTable
ALTER TABLE "TeacherAssignment" ALTER COLUMN "shift" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TeacherProgram" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "program" "Program" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherProgram_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherProgram_teacherId_idx" ON "TeacherProgram"("teacherId");

-- CreateIndex
CREATE INDEX "TeacherProgram_program_idx" ON "TeacherProgram"("program");

-- CreateIndex
CREATE INDEX "TeacherProgram_isActive_idx" ON "TeacherProgram"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProgram_teacherId_program_key" ON "TeacherProgram"("teacherId", "program");

-- AddForeignKey
ALTER TABLE "TeacherProgram" ADD CONSTRAINT "TeacherProgram_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
