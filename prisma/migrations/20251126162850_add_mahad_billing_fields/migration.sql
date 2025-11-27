/*
  Warnings:

  - You are about to drop the column `collegeGradYear` on the `ProgramProfile` table. All the data in the column will be lost.
  - You are about to drop the column `collegeGraduated` on the `ProgramProfile` table. All the data in the column will be lost.
  - You are about to drop the column `customRate` on the `ProgramProfile` table. All the data in the column will be lost.
  - You are about to drop the column `educationLevel` on the `ProgramProfile` table. All the data in the column will be lost.
  - You are about to drop the column `highSchoolGradYear` on the `ProgramProfile` table. All the data in the column will be lost.
  - You are about to drop the column `highSchoolGraduated` on the `ProgramProfile` table. All the data in the column will be lost.
  - You are about to drop the column `postGradCompleted` on the `ProgramProfile` table. All the data in the column will be lost.
  - You are about to drop the column `postGradYear` on the `ProgramProfile` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "GraduationStatus" AS ENUM ('NON_GRADUATE', 'GRADUATE');

-- CreateEnum
CREATE TYPE "PaymentFrequency" AS ENUM ('MONTHLY', 'BI_MONTHLY');

-- CreateEnum
CREATE TYPE "StudentBillingType" AS ENUM ('FULL_TIME', 'FULL_TIME_SCHOLARSHIP', 'PART_TIME', 'EXEMPT');

-- AlterTable
ALTER TABLE "ProgramProfile" DROP COLUMN "collegeGradYear",
DROP COLUMN "collegeGraduated",
DROP COLUMN "customRate",
DROP COLUMN "educationLevel",
DROP COLUMN "highSchoolGradYear",
DROP COLUMN "highSchoolGraduated",
DROP COLUMN "postGradCompleted",
DROP COLUMN "postGradYear",
ADD COLUMN     "billingType" "StudentBillingType",
ADD COLUMN     "graduationStatus" "GraduationStatus",
ADD COLUMN     "paymentFrequency" "PaymentFrequency",
ADD COLUMN     "paymentNotes" TEXT,
ALTER COLUMN "monthlyRate" SET DEFAULT 0;

-- DropEnum
DROP TYPE "EducationLevel";
