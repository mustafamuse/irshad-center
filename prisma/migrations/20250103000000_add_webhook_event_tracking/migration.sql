-- CreateTable for webhook event tracking (idempotency)
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_source_key" ON "WebhookEvent"("eventId", "source");
CREATE INDEX "WebhookEvent_processedAt_idx" ON "WebhookEvent"("processedAt");
CREATE INDEX "WebhookEvent_eventType_idx" ON "WebhookEvent"("eventType");