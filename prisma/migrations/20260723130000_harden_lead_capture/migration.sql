-- Existing user-agent strings are intentionally discarded rather than relabeled as HMAC values.
ALTER TABLE "Lead"
DROP COLUMN "userAgent",
ADD COLUMN "userAgentHash" TEXT;

ALTER TABLE "LeadEvent"
DROP CONSTRAINT "LeadEvent_leadId_fkey";

ALTER TABLE "LeadEvent"
ADD CONSTRAINT "LeadEvent_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
