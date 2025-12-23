-- CreateEnum
CREATE TYPE "public"."NoContactEventType" AS ENUM ('none', 'role_based', 'emotional');

-- CreateEnum
CREATE TYPE "public"."BastanActionCode" AS ENUM ('reality_check', 'adult_responsibility', 'unsent_letter', 'trigger_detox', 'limited_contact', 'meaning_learning', 'closure_ritual', 'commitment_contract');

-- CreateEnum
CREATE TYPE "public"."BastanProgressStatus" AS ENUM ('locked', 'active', 'done');

-- CreateEnum
CREATE TYPE "public"."BastanSubtaskKind" AS ENUM ('checklist', 'form', 'text', 'choice', 'audio', 'signature', 'confirm');

-- AlterTable
ALTER TABLE "public"."NoContactLog" ADD COLUMN     "eventAt" TIMESTAMP(3),
ADD COLUMN     "eventType" "public"."NoContactEventType";

-- CreateTable
CREATE TABLE "public"."BastanActionDefinition" (
    "id" TEXT NOT NULL,
    "code" "public"."BastanActionCode" NOT NULL,
    "titleFa" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "minRequiredSubtasks" INTEGER NOT NULL DEFAULT 0,
    "totalSubtasks" INTEGER NOT NULL DEFAULT 0,
    "xpPerSubtask" INTEGER NOT NULL DEFAULT 0,
    "xpOnComplete" INTEGER NOT NULL DEFAULT 0,
    "medalCode" TEXT,
    "badgeCode" TEXT,
    "isProLocked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BastanActionDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BastanSubtaskDefinition" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "titleFa" TEXT NOT NULL,
    "helpFa" TEXT,
    "kind" "public"."BastanSubtaskKind" NOT NULL DEFAULT 'form',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BastanSubtaskDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BastanActionProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "status" "public"."BastanProgressStatus" NOT NULL DEFAULT 'locked',
    "doneSubtasksCount" INTEGER NOT NULL DEFAULT 0,
    "minRequiredSubtasks" INTEGER NOT NULL DEFAULT 0,
    "totalSubtasks" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BastanActionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BastanSubtaskProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subtaskId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BastanSubtaskProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BastanState" (
    "userId" TEXT NOT NULL,
    "introAudioCompletedAt" TIMESTAMP(3),
    "contractNameTyped" TEXT,
    "contractSignedAt" TIMESTAMP(3),
    "contractSignatureJson" JSONB,
    "lastSafetyCheckAt" TIMESTAMP(3),
    "lastSafetyCheckResult" "public"."NoContactEventType",
    "safetyWindowStartsAt" TIMESTAMP(3),
    "gosastanUnlockedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BastanState_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "BastanActionDefinition_code_key" ON "public"."BastanActionDefinition"("code");

-- CreateIndex
CREATE INDEX "BastanActionDefinition_sortOrder_idx" ON "public"."BastanActionDefinition"("sortOrder");

-- CreateIndex
CREATE INDEX "BastanSubtaskDefinition_actionId_sortOrder_idx" ON "public"."BastanSubtaskDefinition"("actionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BastanSubtaskDefinition_actionId_key_key" ON "public"."BastanSubtaskDefinition"("actionId", "key");

-- CreateIndex
CREATE INDEX "BastanActionProgress_userId_status_idx" ON "public"."BastanActionProgress"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BastanActionProgress_userId_actionId_key" ON "public"."BastanActionProgress"("userId", "actionId");

-- CreateIndex
CREATE INDEX "BastanSubtaskProgress_userId_actionId_idx" ON "public"."BastanSubtaskProgress"("userId", "actionId");

-- CreateIndex
CREATE UNIQUE INDEX "BastanSubtaskProgress_userId_subtaskId_key" ON "public"."BastanSubtaskProgress"("userId", "subtaskId");

-- AddForeignKey
ALTER TABLE "public"."BastanSubtaskDefinition" ADD CONSTRAINT "BastanSubtaskDefinition_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "public"."BastanActionDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BastanActionProgress" ADD CONSTRAINT "BastanActionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BastanActionProgress" ADD CONSTRAINT "BastanActionProgress_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "public"."BastanActionDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BastanSubtaskProgress" ADD CONSTRAINT "BastanSubtaskProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BastanSubtaskProgress" ADD CONSTRAINT "BastanSubtaskProgress_subtaskId_fkey" FOREIGN KEY ("subtaskId") REFERENCES "public"."BastanSubtaskDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BastanSubtaskProgress" ADD CONSTRAINT "BastanSubtaskProgress_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "public"."BastanActionDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BastanState" ADD CONSTRAINT "BastanState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
