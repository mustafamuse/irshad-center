-- DropForeignKey
ALTER TABLE "BillingAccount" DROP CONSTRAINT "BillingAccount_primaryContactPointId_fkey";

-- AlterTable
ALTER TABLE "BillingAccount" DROP COLUMN "primaryContactPointId";
