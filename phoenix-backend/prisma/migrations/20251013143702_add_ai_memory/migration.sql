-- CreateTable
CREATE TABLE "AiMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "AiMemory_userId_key" ON "AiMemory"("userId");
