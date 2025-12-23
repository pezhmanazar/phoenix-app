-- CreateEnum
CREATE TYPE "public"."ReviewTestNo" AS ENUM ('TEST1', 'TEST2');

-- AlterTable
ALTER TABLE "public"."PelekanReviewSession" ADD COLUMN     "questionSetId" TEXT;

-- CreateTable
CREATE TABLE "public"."ReviewQuestionSet" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "titleFa" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewQuestionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewQuestion" (
    "id" TEXT NOT NULL,
    "questionSetId" TEXT NOT NULL,
    "testNo" "public"."ReviewTestNo" NOT NULL,
    "order" INTEGER NOT NULL,
    "key" TEXT,
    "textFa" TEXT NOT NULL,
    "helpFa" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "labelFa" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewQuestionSet_code_isActive_idx" ON "public"."ReviewQuestionSet"("code", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewQuestionSet_code_version_key" ON "public"."ReviewQuestionSet"("code", "version");

-- CreateIndex
CREATE INDEX "ReviewQuestion_questionSetId_testNo_idx" ON "public"."ReviewQuestion"("questionSetId", "testNo");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewQuestion_questionSetId_testNo_order_key" ON "public"."ReviewQuestion"("questionSetId", "testNo", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewOption_questionId_order_key" ON "public"."ReviewOption"("questionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewOption_questionId_value_key" ON "public"."ReviewOption"("questionId", "value");

-- CreateIndex
CREATE INDEX "PelekanReviewSession_questionSetId_idx" ON "public"."PelekanReviewSession"("questionSetId");

-- AddForeignKey
ALTER TABLE "public"."ReviewQuestion" ADD CONSTRAINT "ReviewQuestion_questionSetId_fkey" FOREIGN KEY ("questionSetId") REFERENCES "public"."ReviewQuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewOption" ADD CONSTRAINT "ReviewOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."ReviewQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PelekanReviewSession" ADD CONSTRAINT "PelekanReviewSession_questionSetId_fkey" FOREIGN KEY ("questionSetId") REFERENCES "public"."ReviewQuestionSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
