-- CreateTable
CREATE TABLE "PageViewEvent" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "userAgent" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageViewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageViewSummary" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PageViewSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageViewEvent_path_idx" ON "PageViewEvent"("path");

-- CreateIndex
CREATE INDEX "PageViewEvent_createdAt_idx" ON "PageViewEvent"("createdAt");

-- CreateIndex
CREATE INDEX "PageViewEvent_path_createdAt_idx" ON "PageViewEvent"("path", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PageViewSummary_path_date_key" ON "PageViewSummary"("path", "date");

-- CreateIndex
CREATE INDEX "PageViewSummary_path_idx" ON "PageViewSummary"("path");

-- CreateIndex
CREATE INDEX "PageViewSummary_date_idx" ON "PageViewSummary"("date");
