-- CreateEnum
CREATE TYPE "public"."Sender" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "public"."TicketStatus" AS ENUM ('open', 'pending', 'closed');

-- CreateEnum
CREATE TYPE "public"."TicketType" AS ENUM ('tech', 'therapy');

-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('text', 'voice', 'image', 'file');

-- CreateEnum
CREATE TYPE "public"."AdminRole" AS ENUM ('owner', 'manager', 'agent');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('pending', 'active', 'expired', 'canceled');

-- CreateEnum
CREATE TYPE "public"."AnnouncementPlacement" AS ENUM ('top_banner');

-- CreateEnum
CREATE TYPE "public"."AnnouncementLevel" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "public"."AssessmentKind" AS ENUM ('heartbreak_simple', 'heartbreak_scales', 'relationship_rescan');

-- CreateEnum
CREATE TYPE "public"."PelekanStageCode" AS ENUM ('bastan', 'gosastan', 'sookhtan', 'sarashtan', 'ziestan', 'sakhtan', 'rastan');

-- CreateEnum
CREATE TYPE "public"."PelekanDayStatus" AS ENUM ('active', 'completed', 'failed');

-- CreateTable
CREATE TABLE "public"."Ticket" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contact" TEXT,
    "status" "public"."TicketStatus" NOT NULL DEFAULT 'open',
    "type" "public"."TicketType" NOT NULL DEFAULT 'tech',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "unread" BOOLEAN NOT NULL DEFAULT false,
    "openedById" TEXT,
    "openedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "sender" "public"."Sender" NOT NULL,
    "type" "public"."MessageType" NOT NULL DEFAULT 'text',
    "text" TEXT,
    "fileUrl" TEXT,
    "mime" TEXT,
    "size" INTEGER,
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "public"."AdminRole" NOT NULL DEFAULT 'agent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminSession" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AiMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "fullName" TEXT DEFAULT '',
    "gender" TEXT,
    "birthDate" TIMESTAMP(3),
    "plan" TEXT NOT NULL DEFAULT 'free',
    "planExpiresAt" TIMESTAMP(3),
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "phone" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "refId" TEXT,
    "amount" INTEGER NOT NULL,
    "months" INTEGER NOT NULL,
    "plan" TEXT NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "level" "public"."AnnouncementLevel" NOT NULL DEFAULT 'info',
    "placement" "public"."AnnouncementPlacement" NOT NULL DEFAULT 'top_banner',
    "dismissible" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "targetFree" BOOLEAN NOT NULL DEFAULT true,
    "targetPro" BOOLEAN NOT NULL DEFAULT true,
    "targetExpiring" BOOLEAN NOT NULL DEFAULT false,
    "targetExpired" BOOLEAN NOT NULL DEFAULT false,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnnouncementSeen" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementSeen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PelekanProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL DEFAULT 1,
    "dayIndex" INTEGER NOT NULL DEFAULT 0,
    "gems" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resetCount" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PelekanProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssessmentResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "public"."AssessmentKind" NOT NULL,
    "totalScore" INTEGER,
    "scales" JSONB,
    "wave" INTEGER NOT NULL DEFAULT 1,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AssessmentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PelekanStage" (
    "id" TEXT NOT NULL,
    "code" "public"."PelekanStageCode" NOT NULL,
    "titleFa" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "PelekanStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PelekanDay" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "dayNumberInStage" INTEGER NOT NULL,
    "globalDayNumber" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "requiredPercent" INTEGER NOT NULL DEFAULT 70,

    CONSTRAINT "PelekanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PelekanTask" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "titleFa" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "weightPercent" INTEGER NOT NULL DEFAULT 10,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PelekanTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PelekanDayProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "status" "public"."PelekanDayStatus" NOT NULL DEFAULT 'active',
    "completionPercent" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "xpEarned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PelekanDayProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PelekanTaskProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "PelekanTaskProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."XpLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Medal" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "titleFa" TEXT NOT NULL,
    "description" TEXT,
    "iconKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserMedal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "medalId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMedal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IdentityBadge" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "titleFa" TEXT NOT NULL,
    "description" TEXT,
    "iconKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserIdentityBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserIdentityBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PelekanStreak" (
    "userId" TEXT NOT NULL,
    "currentDays" INTEGER NOT NULL DEFAULT 0,
    "bestDays" INTEGER NOT NULL DEFAULT 0,
    "lastCompletedAt" TIMESTAMP(3),
    "yellowCardAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PelekanStreak_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."NoContactLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "hadContact" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoContactLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_ticketId_idx" ON "public"."Message"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "public"."Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_apiKey_key" ON "public"."Admin"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_token_key" ON "public"."AdminSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "AiMemory_userId_key" ON "public"."AiMemory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "public"."User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_authority_key" ON "public"."Subscription"("authority");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "public"."Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_phone_idx" ON "public"."Subscription"("phone");

-- CreateIndex
CREATE INDEX "Announcement_enabled_placement_priority_idx" ON "public"."Announcement"("enabled", "placement", "priority");

-- CreateIndex
CREATE INDEX "Announcement_startAt_endAt_idx" ON "public"."Announcement"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "AnnouncementSeen_userId_idx" ON "public"."AnnouncementSeen"("userId");

-- CreateIndex
CREATE INDEX "AnnouncementSeen_announcementId_idx" ON "public"."AnnouncementSeen"("announcementId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementSeen_announcementId_userId_key" ON "public"."AnnouncementSeen"("announcementId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PelekanProgress_userId_key" ON "public"."PelekanProgress"("userId");

-- CreateIndex
CREATE INDEX "PelekanProgress_lastActiveAt_idx" ON "public"."PelekanProgress"("lastActiveAt");

-- CreateIndex
CREATE INDEX "PelekanProgress_updatedAt_idx" ON "public"."PelekanProgress"("updatedAt");

-- CreateIndex
CREATE INDEX "AssessmentResult_userId_idx" ON "public"."AssessmentResult"("userId");

-- CreateIndex
CREATE INDEX "AssessmentResult_kind_idx" ON "public"."AssessmentResult"("kind");

-- CreateIndex
CREATE INDEX "AssessmentResult_userId_kind_idx" ON "public"."AssessmentResult"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentResult_userId_kind_wave_key" ON "public"."AssessmentResult"("userId", "kind", "wave");

-- CreateIndex
CREATE UNIQUE INDEX "PelekanStage_code_key" ON "public"."PelekanStage"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PelekanDay_globalDayNumber_key" ON "public"."PelekanDay"("globalDayNumber");

-- CreateIndex
CREATE INDEX "PelekanDay_stageId_dayNumberInStage_idx" ON "public"."PelekanDay"("stageId", "dayNumberInStage");

-- CreateIndex
CREATE INDEX "PelekanTask_dayId_sortOrder_idx" ON "public"."PelekanTask"("dayId", "sortOrder");

-- CreateIndex
CREATE INDEX "PelekanDayProgress_userId_status_idx" ON "public"."PelekanDayProgress"("userId", "status");

-- CreateIndex
CREATE INDEX "PelekanDayProgress_userId_startedAt_idx" ON "public"."PelekanDayProgress"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PelekanDayProgress_userId_dayId_key" ON "public"."PelekanDayProgress"("userId", "dayId");

-- CreateIndex
CREATE INDEX "PelekanTaskProgress_userId_dayId_idx" ON "public"."PelekanTaskProgress"("userId", "dayId");

-- CreateIndex
CREATE UNIQUE INDEX "PelekanTaskProgress_userId_taskId_key" ON "public"."PelekanTaskProgress"("userId", "taskId");

-- CreateIndex
CREATE INDEX "XpLedger_userId_createdAt_idx" ON "public"."XpLedger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Medal_code_key" ON "public"."Medal"("code");

-- CreateIndex
CREATE INDEX "UserMedal_userId_idx" ON "public"."UserMedal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMedal_userId_medalId_key" ON "public"."UserMedal"("userId", "medalId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityBadge_code_key" ON "public"."IdentityBadge"("code");

-- CreateIndex
CREATE INDEX "UserIdentityBadge_userId_idx" ON "public"."UserIdentityBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentityBadge_userId_badgeId_key" ON "public"."UserIdentityBadge"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "NoContactLog_userId_dateKey_idx" ON "public"."NoContactLog"("userId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "NoContactLog_userId_dateKey_key" ON "public"."NoContactLog"("userId", "dateKey");

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnnouncementSeen" ADD CONSTRAINT "AnnouncementSeen_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "public"."Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnnouncementSeen" ADD CONSTRAINT "AnnouncementSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PelekanProgress" ADD CONSTRAINT "PelekanProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssessmentResult" ADD CONSTRAINT "AssessmentResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PelekanDay" ADD CONSTRAINT "PelekanDay_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."PelekanStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PelekanTask" ADD CONSTRAINT "PelekanTask_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "public"."PelekanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PelekanDayProgress" ADD CONSTRAINT "PelekanDayProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PelekanDayProgress" ADD CONSTRAINT "PelekanDayProgress_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "public"."PelekanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PelekanTaskProgress" ADD CONSTRAINT "PelekanTaskProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PelekanTaskProgress" ADD CONSTRAINT "PelekanTaskProgress_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."PelekanTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PelekanTaskProgress" ADD CONSTRAINT "PelekanTaskProgress_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "public"."PelekanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."XpLedger" ADD CONSTRAINT "XpLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserMedal" ADD CONSTRAINT "UserMedal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserMedal" ADD CONSTRAINT "UserMedal_medalId_fkey" FOREIGN KEY ("medalId") REFERENCES "public"."Medal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserIdentityBadge" ADD CONSTRAINT "UserIdentityBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserIdentityBadge" ADD CONSTRAINT "UserIdentityBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "public"."IdentityBadge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PelekanStreak" ADD CONSTRAINT "PelekanStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NoContactLog" ADD CONSTRAINT "NoContactLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
