-- CreateEnum
CREATE TYPE "public"."AssessmentSessionStatus" AS ENUM ('in_progress', 'completed');

-- AlterEnum
ALTER TYPE "public"."AssessmentKind" ADD VALUE 'hb_baseline';

-- CreateTable
CREATE TABLE "public"."AssessmentSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "public"."AssessmentKind" NOT NULL,
    "status" "public"."AssessmentSessionStatus" NOT NULL DEFAULT 'in_progress',
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "answersJson" JSONB,
    "totalScore" INTEGER,
    "scalesJson" JSONB,
    "proLocked" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentSession_userId_kind_idx" ON "public"."AssessmentSession"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentSession_userId_kind_key" ON "public"."AssessmentSession"("userId", "kind");

-- AddForeignKey
ALTER TABLE "public"."AssessmentSession" ADD CONSTRAINT "AssessmentSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
