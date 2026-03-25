-- CreateIndex
CREATE INDEX "BillingAccount_personId_accountType_idx" ON "BillingAccount"("personId", "accountType");

-- CreateIndex
CREATE INDEX "Subscription_billingAccountId_status_idx" ON "Subscription"("billingAccountId", "status");

-- CreateIndex
CREATE INDEX "SubscriptionHistory_subscriptionId_processedAt_idx" ON "SubscriptionHistory"("subscriptionId", "processedAt");

-- DropIndex (redundant: subsumed by composite indexes above via leading-column rule)
DROP INDEX "BillingAccount_personId_idx";

-- DropIndex
DROP INDEX "Subscription_billingAccountId_idx";

-- DropIndex
DROP INDEX "SubscriptionHistory_subscriptionId_idx";
