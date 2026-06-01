ALTER TABLE "PelekanTask"
ADD COLUMN "code" TEXT;

CREATE UNIQUE INDEX "PelekanTask_code_key" ON "PelekanTask"("code");
