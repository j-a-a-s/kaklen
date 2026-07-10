export type CatalogItemType = "PRODUCT" | "SERVICE";
export type CatalogItemStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export interface CatalogItem {
  id: string;
  organizationId: string;
  type: CatalogItemType;
  status: CatalogItemStatus;
  sku: string | null;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  cost: string;
  price: string;
  taxPercent: string;
  currency: string;
  trackInventory: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface PaginatedCatalogItems {
  items: CatalogItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
