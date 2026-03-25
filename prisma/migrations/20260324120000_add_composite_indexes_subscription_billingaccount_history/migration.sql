-- CreateIndex
CREATE INDEX "BillingAccount_personId_accountType_idx" ON "BillingAccount"("personId", "accountType");

-- CreateIndex
CREATE INDEX "Subscription_billingAccountId_status_idx" ON "Subscription"("billingAccountId", "status");

-- CreateIndex
CREATE INDEX "SubscriptionHistory_subscriptionId_processedAt_idx" ON "SubscriptionHistory"("subscriptionId", "processedAt");
