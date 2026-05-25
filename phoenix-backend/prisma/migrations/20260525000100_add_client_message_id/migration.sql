-- Add columns to Message table
ALTER TABLE "Message"
ADD COLUMN "clientMessageId" TEXT,
ADD COLUMN "requestStatus" TEXT NOT NULL DEFAULT 'completed';

-- Create unique constraint for (ticketId, sender, clientMessageId)
CREATE UNIQUE INDEX "Message_ticketId_sender_clientMessageId_key"
ON "Message"("ticketId", "sender", "clientMessageId");

-- Optional index on clientMessageId alone (for faster lookup)
CREATE INDEX "Message_clientMessageId_idx"
ON "Message"("clientMessageId");
