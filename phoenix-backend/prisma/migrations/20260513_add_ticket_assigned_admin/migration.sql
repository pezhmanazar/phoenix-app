-- Add column
ALTER TABLE "Ticket"
ADD COLUMN IF NOT EXISTS "assignedAdminId" TEXT;

-- Create index
CREATE INDEX IF NOT EXISTS "Ticket_assignedAdminId_idx"
ON "Ticket"("assignedAdminId");

-- Add foreign key
ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_assignedAdminId_fkey"
FOREIGN KEY ("assignedAdminId")
REFERENCES "Admin"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
