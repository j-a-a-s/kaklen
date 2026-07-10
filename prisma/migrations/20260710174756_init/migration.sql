-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "defaultLocale" TEXT NOT NULL DEFAULT 'es';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'es';
