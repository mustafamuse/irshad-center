-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "currentPeriodStart" TIMESTAMP(3),
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "subscriptionStatusUpdatedAt" TIMESTAMP(3);
