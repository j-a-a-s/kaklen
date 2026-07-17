-- DropForeignKey
ALTER TABLE "QuotationStatusHistory" DROP CONSTRAINT "QuotationStatusHistory_changedByUserId_fkey";

-- AlterTable
ALTER TABLE "QuotationStatusHistory" ALTER COLUMN "changedByUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "QuotationStatusHistory" ADD CONSTRAINT "QuotationStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
