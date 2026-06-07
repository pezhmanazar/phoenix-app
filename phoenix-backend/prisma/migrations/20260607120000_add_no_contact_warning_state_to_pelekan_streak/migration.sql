-- AlterTable
ALTER TABLE "PelekanStreak"
ADD COLUMN "noContactWarningState" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN "noContactViolationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "noContactResetCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastNoContactViolationAt" TIMESTAMP(3),
ADD COLUMN "lastNoContactResetAt" TIMESTAMP(3);