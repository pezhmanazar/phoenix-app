ALTER TABLE "User"
ADD COLUMN "appProvider" TEXT NOT NULL DEFAULT 'unknown';

CREATE INDEX "User_appProvider_idx"
ON "User"("appProvider");