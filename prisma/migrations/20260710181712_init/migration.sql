-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "dateFormat" TEXT NOT NULL DEFAULT 'dd-MM-yyyy',
ADD COLUMN     "numberFormat" TEXT NOT NULL DEFAULT 'es';
