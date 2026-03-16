-- CreateIndex
CREATE INDEX "Donation_status_isRecurring_stripeSubscriptionId_idx" ON "Donation"("status", "isRecurring", "stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Donation_status_donorEmail_idx" ON "Donation"("status", "donorEmail");
