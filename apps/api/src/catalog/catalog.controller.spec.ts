import { CatalogItemType } from "@prisma/client";
import { CatalogController } from "./catalog.controller";

describe("CatalogController", () => {
  it("delegates catalog CRUD and search with actor context", async () => {
    const service = makeCatalogService();
    const controller = new CatalogController(service as never);
    const request = { user: { sub: "user-1" } };
    const dto = {
      type: CatalogItemType.PRODUCT,
      code: "SKU-1",
      name: "Speaker",
      unit: "unit",
      cost: 100,
      price: 200,
      taxPercent: 19,
      currency: "CLP"
    };

    await controller.create("org-1", request as never, dto);
    await controller.list("org-1", { page: 1, pageSize: 20 });
    await controller.search("org-1", { search: "speaker" });
    await controller.get("org-1", "catalog-1");
    await controller.update("org-1", "catalog-1", request as never, { name: "Speaker Pro" });
    await controller.archive("org-1", "catalog-1", request as never);

    expect(service.create).toHaveBeenCalledWith("org-1", "user-1", dto);
    expect(service.list).toHaveBeenCalledWith("org-1", { search: "speaker" });
    expect(service.update).toHaveBeenCalledWith("org-1", "catalog-1", "user-1", { name: "Speaker Pro" });
    expect(service.archive).toHaveBeenCalledWith("org-1", "catalog-1", "user-1");
  });
});

function makeCatalogService() {
  const ok = async () => ({ id: "result" });
  return {
    create: jest.fn(ok),
    list: jest.fn(ok),
    get: jest.fn(ok),
    update: jest.fn(ok),
    archive: jest.fn(async () => undefined)
  };
}
