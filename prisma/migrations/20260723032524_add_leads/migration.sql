-- CreateEnum
CREATE TYPE "LeadInterest" AS ENUM ('ADVISORY', 'KAKLEN', 'PLATFORM_DEVELOPMENT', 'DIGITAL_TRANSFORMATION', 'INVESTMENT_PARTNERSHIP', 'KAPIAR', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'OPPORTUNITY', 'CLOSED_WON', 'CLOSED_LOST', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LeadWhatsAppStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneCountryCode" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "company" TEXT,
    "position" TEXT,
    "country" TEXT,
    "interestType" "LeadInterest" NOT NULL,
    "message" TEXT NOT NULL,
    "privacyConsent" BOOLEAN NOT NULL,
    "whatsappConsent" BOOLEAN NOT NULL,
    "consentTextVersion" TEXT NOT NULL,
    "consentRecordedAt" TIMESTAMP(3) NOT NULL,
    "consentIpHash" TEXT,
    "userAgent" TEXT,
    "source" TEXT NOT NULL DEFAULT 'kaklen-marketing',
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "landingPage" TEXT,
    "referrer" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "whatsappStatus" "LeadWhatsAppStatus",
    "whatsappSentAt" TIMESTAMP(3),
    "whatsappError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_phoneE164_idx" ON "Lead"("phoneE164");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "LeadEvent_leadId_idx" ON "LeadEvent"("leadId");

-- AddForeignKey
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
