-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('succeeded', 'pending', 'failed', 'refunded', 'cancelled');

-- AlterTable: convert status from text to enum
ALTER TABLE "Donation" ALTER COLUMN "status" TYPE "DonationStatus" USING "status"::"DonationStatus";

-- CreateIndex
CREATE INDEX "Donation_stripeSubscriptionId_idx" ON "Donation"("stripeSubscriptionId");
