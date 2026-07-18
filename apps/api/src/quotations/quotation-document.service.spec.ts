import { ConflictException, Logger } from "@nestjs/common";
import { Prisma, QuotationDiscountType, QuotationStatus } from "@prisma/client";
import { calculateQuotationMoney, moneyToMinorUnits, QuotationMoneyLineInput } from "@kaklen/shared";
import {
  buildQuotationDocumentLayout,
  QuotationDocumentService,
  QuotationDocumentSource,
  resolveQuotationLogoPath,
  wrapTextToWidth
} from "./quotation-document.service";
import { measurePdfText } from "./pdf";

describe("QuotationDocumentService", () => {
  const service = new QuotationDocumentService();

  it("builds a localized view model from the exact shared result", () => {
    const source = documentSource([
      line({ discountType: QuotationDiscountType.FIXED, discountValue: "10000" }),
      line({ code: "SERV-2" })
    ], "5");
    const view = service.buildViewModel(source, "es");

    expect(view.quotation.status).toBe("Enviada");
    expect(view.organization.taxId).toBe("76123456-7");
    expect(view.client.whatsapp).toBe("+56912345678");
    expect(view.totals.lineDiscount).toContain("10.000");
    expect(view.totals.globalDiscount).toContain("9.500");
    expect(view.totals.discountTotal).toContain("19.500");
    expect(view.totals.taxableBase).toContain("180.500");
    expect(view.items[0].tax).toContain("16.245");
  });

  it.each([
    ["quantity 1.333", [line({ quantity: "1.333", unitPrice: "20" })], "0", "CLP"],
    ["price with cents", [line({ unitPrice: "10.25" })], "0", "USD"],
    ["three residual lines", [line({ quantity: "0.333", unitPrice: "10.01" }), line({ quantity: "0.333", unitPrice: "10.01" }), line({ quantity: "0.334", unitPrice: "10.01" })], "0", "USD"],
    ["global discount 5 percent", [line(), line({ code: "SERV-2", unitPrice: "333" })], "5", "CLP"],
    ["global discount 100 percent", [line()], "100", "CLP"],
    ["fixed discount", [line({ discountType: QuotationDiscountType.FIXED, discountValue: "25.50" })], "0", "USD"],
    ["percentage discount", [line({ discountType: QuotationDiscountType.PERCENTAGE, discountValue: "12.5" })], "0", "USD"],
    ["global discount after a line discount", [line({ discountType: QuotationDiscountType.FIXED, discountValue: "10" }), line({ code: "SERV-2" })], "5", "CLP"],
    ["VAT 19 percent", [line({ taxPercent: "19" })], "0", "CLP"],
    ["tax exempt line", [line({ taxPercent: "0" })], "0", "CLP"],
    ["large values", [line({ quantity: "999.999", unitPrice: "999999.99" })], "0", "USD"]
  ])("keeps shared, persisted, ViewModel, and PDF text in parity for %s", (_name, lines, globalDiscount, currency) => {
    const source = documentSource(lines as TestLine[], globalDiscount as string, currency as string);
    const expected = calculateQuotationMoney(lines as TestLine[], globalDiscount as string, { currency: currency as string });
    const view = service.buildViewModel(source, "en");
    const document = service.render(view);
    const text = document.toString("latin1");

    expect(moneyToMinorUnits(source.total.toString(), currency as string)).toBe(moneyToMinorUnits(expected.total, currency as string));
    expect(view.totals.total).not.toBe("");
    expect(text).toContain(view.totals.total);
    expect(text).toContain("%%EOF");
  });

  it("renders 75 lines across multiple pages from one exact calculation", () => {
    const lines = Array.from({ length: 75 }, (_, index) => line({
      code: `SERV-${index + 1}`,
      name: `Servicio profesional ${index + 1}`,
      description: "Descripción extensa que debe mantenerse completa dentro de la misma fila del documento."
    }));
    const source = documentSource(lines, "3.25", "USD");
    const document = service.render(service.buildViewModel(source, "en"));
    const text = document.toString("latin1");

    expect(document.subarray(0, 4).toString()).toBe("%PDF");
    expect(text).toMatch(/\/Count [2-9]/);
    expect(text).toContain("Kaklen QuotationDocumentService");
    expect(text).toContain("Page 1 of");
    expect(text).toContain("Servicio profesional 1");
  });

  it("embeds the official portable logo on every page", () => {
    const view = service.buildViewModel(documentSource(Array.from({ length: 20 }, (_, index) =>
      line({ code: `LOGO-${index + 1}` })
    ), "0", "CLP"), "es");
    const layout = buildQuotationDocumentLayout(view);
    const document = service.render(view).toString("latin1");

    expect(resolveQuotationLogoPath()).not.toBeNull();
    expect(layout.logo?.name).toBe("KaklenLogo");
    expect(layout.pages.every((page) => page.some((command) => command.kind === "image" && command.name === "KaklenLogo"))).toBe(true);
    expect(document).toContain("/Subtype /Image");
    expect(document).toContain("/KaklenLogo");
  });

  it.each([1, 20, 75])("keeps all of %i rows intact and repeats the table header", (count) => {
    const lines = Array.from({ length: count }, (_, index) => line({
      code: `ROW-${String(index + 1).padStart(3, "0")}`,
      name: `Name ${index + 1}`,
      description: `Description ${index + 1} with enough content to exercise measured wrapping.`
    }));
    const layout = buildQuotationDocumentLayout(service.buildViewModel(documentSource(lines, "1", "USD"), "en"));

    lines.forEach((item) => {
      const codePages = layout.pages.flatMap((page, index) =>
        page.some((command) => command.kind === "text" && command.text === item.code) ? [index] : []
      );
      const namePage = layout.pages.findIndex((page) =>
        page.some((command) => command.kind === "text" && command.text === item.name)
      );
      const descriptionPage = layout.pages.findIndex((page) =>
        page.some((command) => command.kind === "text" && command.text.startsWith(`Description ${item.code.slice(4).replace(/^0+/, "")}`))
      );
      expect(codePages).toHaveLength(1);
      expect(namePage).toBe(codePages[0]);
      expect(descriptionPage).toBe(codePages[0]);
    });
    layout.pages.filter((page) => page.some((command) =>
      command.kind === "text" && command.text.startsWith("ROW-")
    )).forEach((page) => {
      expect(page.some((command) => command.kind === "text" && command.text === "Product or service")).toBe(true);
    });
  });

  it("wraps long content by font metrics without ellipsis or page-bound collisions", () => {
    const source = documentSource([line({
      code: "LONG-1",
      name: `Service ${"WIDE-NAME ".repeat(12)}END_NAME`,
      description: `${"Detailed scope and deliverable ".repeat(35)}END_DESCRIPTION`
    })], "0", "EUR");
    source.organization = {
      ...source.organization!,
      legalName: `${"Very Long Organization Name ".repeat(8)}END_ORGANIZATION`,
      address: `${"Long business address ".repeat(12)}END_ADDRESS`
    };
    source.client = {
      ...source.client,
      legalName: `${"Very Long Client Name ".repeat(8)}END_CLIENT`,
      address: `${"Long client address ".repeat(12)}END_CLIENT_ADDRESS`
    };
    source.notes = `${"Long note content ".repeat(80)}END_NOTES`;
    source.terms = `${"Long terms content ".repeat(80)}END_TERMS`;
    const layout = buildQuotationDocumentLayout(service.buildViewModel(source, "pt-BR"));
    const textCommands = layout.pages.flat().filter((command) => command.kind === "text");
    const joined = textCommands.map((command) => command.text).join(" ");

    expect(joined).toContain("END_NAME");
    expect(joined).toContain("END_DESCRIPTION");
    expect(joined).toContain("END_ORGANIZATION");
    expect(joined).toContain("END_CLIENT_ADDRESS");
    expect(joined).toContain("END_NOTES");
    expect(joined).toContain("END_TERMS");
    expect(joined).not.toContain("...");
    textCommands.forEach((command) => {
      expect(command.x).toBeGreaterThanOrEqual(0);
      expect(command.y).toBeGreaterThanOrEqual(0);
      expect(command.y).toBeLessThanOrEqual(842);
      expect(command.x + measurePdfText(command.text, command.size, command.bold)).toBeLessThanOrEqual(595.5);
    });
  });

  it("wraps using glyph widths rather than character count", () => {
    const lines = wrapTextToWidth("WWWW iiiii WWWW", 32, 10);

    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((line) => expect(measurePdfText(line, 10)).toBeLessThanOrEqual(32));
  });

  it("supports zero lines and long notes without producing an empty PDF", () => {
    const source = documentSource([], "0", "BRL");
    source.notes = "Nota ".repeat(500);
    source.terms = "Término ".repeat(500);
    const document = service.render(service.buildViewModel(source, "pt-BR"));

    expect(document.byteLength).toBeGreaterThan(1500);
    expect(document.toString("latin1")).toContain("Sem itens");
  });

  it("rejects a PDF when persisted totals differ by one minor unit", () => {
    const source = documentSource([line()], "0", "USD");
    source.total = new Prisma.Decimal(source.total.toString()).plus("0.01");
    const log = jest.spyOn(Logger.prototype, "error").mockImplementation();

    expect(() => service.buildViewModel(source, "en")).toThrow(ConflictException);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("field=total"));
    log.mockRestore();
  });
});

interface TestLine extends QuotationMoneyLineInput {
  code: string;
  name: string;
  description: string;
  unit: string;
  discountType: QuotationDiscountType;
  discountValue: string;
}

function line(overrides: Partial<TestLine> = {}): TestLine {
  return {
    code: "SERV-1",
    name: "Service professional",
    description: "Consultoría especializada",
    quantity: "1",
    unit: "unidad",
    unitPrice: "100000",
    discountType: QuotationDiscountType.NONE,
    discountValue: "0",
    taxPercent: "19",
    ...overrides
  };
}

function documentSource(
  lines: readonly TestLine[] = [line()],
  globalDiscountPercent = "0",
  currency = "CLP"
): QuotationDocumentSource {
  const calculated = calculateQuotationMoney(lines, globalDiscountPercent, { currency });
  return {
    number: "QUO-000001",
    version: 2,
    status: QuotationStatus.SENT,
    issueDate: new Date("2026-07-01T12:00:00.000Z"),
    validUntil: new Date("2026-07-31T12:00:00.000Z"),
    currency,
    globalDiscountPercent: new Prisma.Decimal(globalDiscountPercent),
    subtotal: new Prisma.Decimal(calculated.subtotal),
    discountTotal: new Prisma.Decimal(calculated.discountTotal),
    taxTotal: new Prisma.Decimal(calculated.taxTotal),
    total: new Prisma.Decimal(calculated.total),
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
    items: lines.map((item, index) => ({
      code: item.code,
      name: item.name,
      description: item.description,
      quantity: new Prisma.Decimal(item.quantity),
      unit: item.unit,
      unitPrice: new Prisma.Decimal(item.unitPrice),
      discountType: item.discountType,
      discountValue: new Prisma.Decimal(item.discountValue),
      subtotal: new Prisma.Decimal(calculated.lines[index].subtotal),
      discountTotal: new Prisma.Decimal(calculated.lines[index].discountTotal),
      taxPercent: new Prisma.Decimal(item.taxPercent),
      taxTotal: new Prisma.Decimal(calculated.lines[index].taxTotal),
      total: new Prisma.Decimal(calculated.lines[index].total)
    })),
    history: [{ newStatus: QuotationStatus.SENT, note: null, createdAt: new Date("2026-07-02T12:00:00.000Z") }]
  };
}
