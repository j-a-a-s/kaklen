-- CreateEnum
CREATE TYPE "CatalogItemType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "CatalogItemStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "CatalogItemType" NOT NULL,
    "status" "CatalogItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "sku" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "taxPercent" DECIMAL(5,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "trackInventory" BOOLEAN NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogItem_organizationId_idx" ON "CatalogItem"("organizationId");

-- CreateIndex
CREATE INDEX "CatalogItem_organizationId_status_idx" ON "CatalogItem"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CatalogItem_organizationId_type_idx" ON "CatalogItem"("organizationId", "type");

-- CreateIndex
CREATE INDEX "CatalogItem_organizationId_code_idx" ON "CatalogItem"("organizationId", "code");

-- CreateIndex
CREATE INDEX "CatalogItem_organizationId_sku_idx" ON "CatalogItem"("organizationId", "sku");

-- CreateIndex
CREATE INDEX "CatalogItem_organizationId_name_idx" ON "CatalogItem"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_organizationId_code_key" ON "CatalogItem"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
