import { Prisma, QuotationDiscountType, QuotationStatus } from "@prisma/client";
import { QuotationDocumentService, QuotationDocumentSource } from "./quotation-document.service";

describe("QuotationDocumentService", () => {
  const service = new QuotationDocumentService();

  it("builds a localized view model with separate line and global discounts", () => {
    const view = service.buildViewModel(source(), "es");

    expect(view.quotation.status).toBe("Enviada");
    expect(view.organization.taxId).toBe("76123456-7");
    expect(view.client.whatsapp).toBe("+56912345678");
    expect(view.totals.lineDiscount).toContain("10.000");
    expect(view.totals.globalDiscount).toContain("5.000");
    expect(view.totals.taxableBase).toContain("85.000");
  });

  it("renders selectable multipage PDF content with metadata and page numbers", () => {
    const manyItems = Array.from({ length: 75 }, (_, index) => ({
      ...source().items[0],
      code: `SERV-${index + 1}`,
      name: `Servicio profesional ${index + 1}`,
      description: "Descripción extensa que debe mantenerse completa dentro de la misma fila del documento."
    }));
    const document = service.render(service.buildViewModel({ ...source(), items: manyItems }, "en"));
    const text = document.toString("latin1");

    expect(document.subarray(0, 4).toString()).toBe("%PDF");
    expect(text).toContain("/Count ");
    expect(text).toMatch(/\/Count [2-9]/);
    expect(text).toContain("Kaklen QuotationDocumentService");
    expect(text).toContain("Page 1 of");
    expect(text).toContain("Servicio profesional 1");
    expect(text).toContain("%%EOF");
  });

  it("supports zero lines and long notes without producing an empty PDF", () => {
    const document = service.render(service.buildViewModel({
      ...source(),
      items: [],
      notes: "Nota ".repeat(500),
      terms: "Término ".repeat(500)
    }, "pt-BR"));

    expect(document.byteLength).toBeGreaterThan(1500);
    expect(document.toString("latin1")).toContain("Sem itens");
  });
});

function source(): QuotationDocumentSource {
  return {
    number: "QUO-000001",
    version: 2,
    status: QuotationStatus.SENT,
    issueDate: new Date("2026-07-01T12:00:00.000Z"),
    validUntil: new Date("2026-07-31T12:00:00.000Z"),
    currency: "CLP",
    subtotal: new Prisma.Decimal(100000),
    discountTotal: new Prisma.Decimal(15000),
    taxTotal: new Prisma.Decimal(16150),
    total: new Prisma.Decimal(101150),
    notes: "Coordinar fecha con el cliente.",
    terms: "Vigencia de treinta días.",
    createdBy: { firstName: "Ada", lastName: "Lovelace" },
    organization: {
      name: "Kaklen Demo",
      legalName: "Kaklen Demo SpA",
      taxId: "76123456-7",
      address: "Santiago",
      phone: "+56221234567",
      whatsapp: "+56911111111"
    },
    client: {
      displayName: "Cliente Demo",
      legalName: "Cliente Demo SpA",
      taxId: "76543210-3",
      whatsapp: "+56912345678",
      email: "cliente@example.com",
      address: "Providencia"
    },
    items: [{
      code: "SERV-1",
      name: "Service professional",
      description: "Consultoría especializada",
      quantity: new Prisma.Decimal(1),
      unit: "unidad",
      unitPrice: new Prisma.Decimal(100000),
      discountType: QuotationDiscountType.FIXED,
      discountValue: new Prisma.Decimal(10000),
      discountTotal: new Prisma.Decimal(15000),
      taxPercent: new Prisma.Decimal(19),
      total: new Prisma.Decimal(101150)
    }],
    history: [{ newStatus: QuotationStatus.SENT, note: null, createdAt: new Date("2026-07-02T12:00:00.000Z") }]
  };
}
