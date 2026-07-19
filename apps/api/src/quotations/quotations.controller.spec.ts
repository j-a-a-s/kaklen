import { QuotationItemType } from "@prisma/client";
import { REQUIRED_PERMISSIONS_KEY } from "../organizations/require-permissions.decorator";
import { QuotationsController } from "./quotations.controller";

describe("QuotationsController", () => {
  it("delegates quotation operations with organization and actor context", async () => {
    const service = makeQuotationsService();
    const controller = new QuotationsController(service as never);
    const request = { user: { sub: "user-1" } };
    const createDto = {
      clientId: "client-1",
      issueDate: "2026-08-01",
      validUntil: "2026-08-31",
      items: [{ type: QuotationItemType.CUSTOM, name: "Item", quantity: 1, unit: "unit", unitPrice: 100, taxPercent: 19 }]
    };

    await controller.create("org-1", request as never, createDto);
    await controller.list("org-1", { page: 1, pageSize: 20 });
    await controller.summary("org-1");
    await controller.changeRequests("org-1", "quotation-1");
    await controller.get("org-1", "quotation-1");
    await controller.update("org-1", "quotation-1", request as never, { notes: "Updated" });
    await controller.recalculateTotals("org-1", "quotation-1", request as never);
    await controller.archive("org-1", "quotation-1", request as never);
    await controller.send("org-1", "quotation-1", request as never, { note: "Sent" });
    await controller.approve("org-1", "quotation-1", request as never, { note: "Approved" });
    await controller.reject("org-1", "quotation-1", request as never, { note: "Rejected" });
    await controller.cancel("org-1", "quotation-1", request as never, { note: "Cancelled" });
    await controller.newVersion("org-1", "quotation-1", request as never);
    await controller.history("org-1", "quotation-1");
    const emailDto = { to: "client@example.com", subject: "Quotation", message: "Please review", locale: "en" as const };
    await controller.sendEmail("org-1", "quotation-1", request as never, emailDto);

    expect(service.create).toHaveBeenCalledWith("org-1", "user-1", createDto);
    expect(service.update).toHaveBeenCalledWith("org-1", "quotation-1", "user-1", { notes: "Updated" });
    expect(service.recalculateTotals).toHaveBeenCalledWith("org-1", "quotation-1", "user-1");
    expect(service.approve).toHaveBeenCalledWith("org-1", "quotation-1", "user-1", { note: "Approved" });
    expect(service.newVersion).toHaveBeenCalledWith("org-1", "quotation-1", "user-1");
    expect(service.changeRequests).toHaveBeenCalledWith("org-1", "quotation-1");
    expect(service.sendEmail).toHaveBeenCalledWith("org-1", "quotation-1", "user-1", emailDto);
  });

  it("sends quotation PDFs with stable content headers", async () => {
    const service = makeQuotationsService();
    const controller = new QuotationsController(service as never);
    const response = {
      setHeader: jest.fn(),
      send: jest.fn()
    };

    await controller.pdf("org-1", "quotation-1", undefined, response as never);

    expect(service.pdfDocument).toHaveBeenCalledWith("org-1", "quotation-1", "es");
    expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(response.setHeader).toHaveBeenCalledWith("Content-Disposition", 'attachment; filename="cotizacion-quo-000001-v1.pdf"');
    expect(response.send).toHaveBeenCalledWith(Buffer.from("pdf"));
  });

  it("keeps backend RBAC on every quotation endpoint", () => {
    const permissions = [
      ["create", "quotations.create"],
      ["list", "quotations.read"],
      ["summary", "quotations.read"],
      ["changeRequests", "quotations.read"],
      ["get", "quotations.read"],
      ["update", "quotations.update"],
      ["recalculateTotals", "quotations.update"],
      ["archive", "quotations.delete"],
      ["send", "quotations.send"],
      ["approve", "quotations.approve"],
      ["reject", "quotations.reject"],
      ["cancel", "quotations.send"],
      ["newVersion", "quotations.update"],
      ["history", "quotations.read"],
      ["pdf", "quotations.read"],
      ["sendEmail", "quotations.send"]
    ] as const;

    for (const [method, permission] of permissions) {
      expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, QuotationsController.prototype[method]))
        .toEqual([permission]);
    }
  });
});

function makeQuotationsService() {
  const ok = async () => ({ id: "result" });
  return {
    create: jest.fn(ok),
    list: jest.fn(ok),
    summary: jest.fn(ok),
    changeRequests: jest.fn(ok),
    get: jest.fn(ok),
    update: jest.fn(ok),
    recalculateTotals: jest.fn(ok),
    archive: jest.fn(async () => undefined),
    send: jest.fn(ok),
    approve: jest.fn(ok),
    reject: jest.fn(ok),
    cancel: jest.fn(ok),
    newVersion: jest.fn(ok),
    history: jest.fn(ok),
    pdf: jest.fn(async () => Buffer.from("pdf")),
    pdfDocument: jest.fn(async () => ({ buffer: Buffer.from("pdf"), filename: "cotizacion-quo-000001-v1.pdf" })),
    sendEmail: jest.fn(ok)
  };
}
