-- Add notification campaign content fields

ALTER TABLE "NotificationCampaign"
ADD COLUMN "notificationType" "NotificationType" NOT NULL DEFAULT 'marketing',
ADD COLUMN "pushTitle" TEXT,
ADD COLUMN "pushBody" TEXT,
ADD COLUMN "data" JSONB,
ADD COLUMN "targetCount" INTEGER;

CREATE INDEX "NotificationCampaign_status_idx"
ON "NotificationCampaign"("status");

CREATE INDEX "NotificationCampaign_type_idx"
ON "NotificationCampaign"("type");

CREATE INDEX "NotificationCampaign_scheduledAt_idx"
ON "NotificationCampaign"("scheduledAt");