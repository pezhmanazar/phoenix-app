-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'ticket_reply',
  'subscription',
  'payment',
  'pelekan',
  'assessment',
  'reminder',
  'marketing',
  'system'
);

-- CreateEnum
CREATE TYPE "NotificationCampaignType" AS ENUM (
  'therapeutic',
  'sales',
  'system',
  'motivational'
);

-- CreateEnum
CREATE TYPE "NotificationCampaignStatus" AS ENUM (
  'draft',
  'scheduled',
  'sending',
  'completed',
  'failed'
);

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
  'pending',
  'sent',
  'delivered',
  'opened',
  'failed'
);

-- CreateTable
CREATE TABLE "NotificationCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "NotificationCampaignType" NOT NULL,
    "createdById" TEXT,
    "status" "NotificationCampaignStatus" NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "targetRule" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "deviceTokenId" TEXT,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'pending',
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_deviceTokenId_idx" ON "NotificationDelivery"("deviceTokenId");

-- AddForeignKey
ALTER TABLE "NotificationCampaign"
ADD CONSTRAINT "NotificationCampaign_createdById_fkey"
FOREIGN KEY ("createdById")
REFERENCES "Admin"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_campaignId_fkey"
FOREIGN KEY ("campaignId")
REFERENCES "NotificationCampaign"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_notificationId_fkey"
FOREIGN KEY ("notificationId")
REFERENCES "Notification"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_deviceTokenId_fkey"
FOREIGN KEY ("deviceTokenId")
REFERENCES "DeviceToken"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;