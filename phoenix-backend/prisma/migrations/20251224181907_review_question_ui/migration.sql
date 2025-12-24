-- AlterTable
ALTER TABLE "public"."AssessmentSession" ADD COLUMN     "resultSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."ReviewQuestion" ADD COLUMN     "ui" JSONB;
