-- CreateEnum
CREATE TYPE "public"."PelekanReviewStatus" AS ENUM ('in_progress', 'completed_locked', 'unlocked');

-- AlterEnum
ALTER TYPE "public"."AssessmentKind" ADD VALUE 'ex_returns';

-- AlterTable
ALTER TABLE "public"."PelekanDayProgress" ADD COLUMN     "fullDoneAt" TIMESTAMP(3),
ADD COLUMN     "lastResetAt" TIMESTAMP(3),
ADD COLUMN     "minDoneAt" TIMESTAMP(3),
ADD COLUMN     "resetCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unlockedNextAt" TIMESTAMP(3),
ALTER COLUMN "deadlineAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."PelekanProgress" ADD COLUMN     "bastanIntroAudioCompletedAt" TIMESTAMP(3),
ADD COLUMN     "bastanIntroAudioStartedAt" TIMESTAMP(3),
ADD COLUMN     "bastanPaywallShownAt" TIMESTAMP(3),
ADD COLUMN     "bastanUnlockedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."PelekanReviewSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."PelekanReviewStatus" NOT NULL DEFAULT 'in_progress',
    "chosenPath" TEXT,
    "currentTest" INTEGER NOT NULL DEFAULT 1,
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "paywallShownAt" TIMESTAMP(3),
    "unlockedAt" TIMESTAMP(3),
    "test1CompletedAt" TIMESTAMP(3),
    "test2CompletedAt" TIMESTAMP(3),
    "answersJson" JSONB,
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PelekanReviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PelekanReviewSession_userId_key" ON "public"."PelekanReviewSession"("userId");

-- AddForeignKey
ALTER TABLE "public"."PelekanReviewSession" ADD CONSTRAINT "PelekanReviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
