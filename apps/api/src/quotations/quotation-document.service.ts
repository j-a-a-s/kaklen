import { Injectable } from "@nestjs/common";
import { QuotationDiscountType, QuotationStatus } from "@prisma/client";
import { calculateQuotationMoney, formatMoney, moneyToMinorUnits } from "@kaklen/shared";
import type { QuotationMoneyResult } from "@kaklen/shared";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createPdfDocument, measurePdfText, PdfCommand } from "./pdf";
import type { PdfImageResource } from "./pdf";
import { loadPngImage } from "./png-image";
import { assertPersistedQuotationMoneyParity } from "./quotation-money-consistency";

type Locale = "es" | "en" | "pt-BR";

interface DecimalValue {
  toString(): string;
}

export interface QuotationDocumentSource {
  number: string;
  version: number;
  status: QuotationStatus;
  issueDate: Date;
  validUntil: Date;
  currency: string;
  globalDiscountPercent: DecimalValue;
  subtotal: DecimalValue;
  discountTotal: DecimalValue;
  taxTotal: DecimalValue;
  total: DecimalValue;
  notes: string | null;
  terms: string | null;
  createdBy?: { firstName: string; lastName: string };
  organization?: {
    name: string;
    legalName: string | null;
    taxId: string | null;
    address: string | null;
    phone: string | null;
    whatsapp: string | null;
  };
  client: {
    displayName: string;
    legalName: string | null;
    taxId: string | null;
    whatsapp: string | null;
    email: string | null;
    address: string | null;
  };
  items: Array<{
    code: string | null;
    name: string;
    description: string | null;
    quantity: DecimalValue;
    unit: string;
    unitPrice: DecimalValue;
    discountType: QuotationDiscountType;
    discountValue: DecimalValue;
    subtotal: DecimalValue;
    discountTotal: DecimalValue;
    taxPercent: DecimalValue;
    taxTotal: DecimalValue;
    total: DecimalValue;
  }>;
  history?: Array<{
    newStatus: QuotationStatus;
    note: string | null;
    createdAt: Date;
  }>;
}

export interface QuotationDocumentItemViewModel {
  code: string;
  name: string;
  description: string;
  quantityAndUnit: string;
  unitPrice: string;
  subtotal: string;
  lineDiscount: string;
  globalDiscount: string;
  discountTotal: string;
  taxableBase: string;
  tax: string;
  total: string;
}

export interface QuotationDocumentViewModel {
  locale: Locale;
  generatedAt: Date;
  organization: {
    name: string;
    legalName: string;
    taxId: string;
    address: string;
    phone: string;
    whatsapp: string;
  };
  client: {
    name: string;
    legalName: string;
    taxId: string;
    whatsapp: string;
    email: string;
    address: string;
  };
  quotation: {
    title: string;
    number: string;
    version: string;
    status: string;
    issueDate: string;
    validUntil: string;
    executive: string;
    currency: string;
  };
  items: QuotationDocumentItemViewModel[];
  totals: {
    subtotal: string;
    lineDiscount: string;
    globalDiscount: string;
    discountTotal: string;
    taxableBase: string;
    tax: string;
    total: string;
  };
  notes: string;
  terms: string;
  history: string[];
}

@Injectable()
export class QuotationDocumentService {
  buildViewModel(source: QuotationDocumentSource, locale: string): QuotationDocumentViewModel {
    const language = normalizeLocale(locale);
    const labels = documentLabels(language);
    const calculated = calculateQuotationMoney(
      source.items.map((item) => ({
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        discountType: item.discountType,
        discountValue: item.discountValue.toString(),
        taxPercent: item.taxPercent.toString()
      })),
      source.globalDiscountPercent.toString(),
      { currency: source.currency }
    );
    this.assertPersistenceParity(source, calculated);
    const money = (value: string): string => formatExactMoney(value, source.currency, language);
    const date = (value: Date): string =>
      new Intl.DateTimeFormat(numberLocale(language), { dateStyle: "medium" }).format(value);
    const organization = source.organization;
    return {
      locale: language,
      generatedAt: new Date(),
      organization: {
        name: organization?.name ?? "Kaklen",
        legalName: organization?.legalName ?? "",
        taxId: organization?.taxId ?? "",
        address: organization?.address ?? "",
        phone: organization?.phone ?? "",
        whatsapp: organization?.whatsapp ?? ""
      },
      client: {
        name: source.client.displayName,
        legalName: source.client.legalName ?? "",
        taxId: source.client.taxId ?? "",
        whatsapp: source.client.whatsapp ?? "",
        email: source.client.email ?? "",
        address: source.client.address ?? ""
      },
      quotation: {
        title: labels.quotation,
        number: source.number,
        version: String(source.version),
        status: statusLabel(source.status, language),
        issueDate: date(source.issueDate),
        validUntil: date(source.validUntil),
        executive: source.createdBy ? `${source.createdBy.firstName} ${source.createdBy.lastName}`.trim() : "Kaklen",
        currency: source.currency
      },
      items: source.items.map((item, index) => ({
        code: item.code ?? "-",
        name: item.name,
        description: item.description ?? "",
        quantityAndUnit: `${item.quantity.toString()} ${item.unit}`,
        unitPrice: money(item.unitPrice.toString()),
        subtotal: money(calculated.lines[index].subtotal),
        lineDiscount: money(calculated.lines[index].lineDiscountTotal),
        globalDiscount: money(calculated.lines[index].globalDiscountTotal),
        discountTotal: money(calculated.lines[index].discountTotal),
        taxableBase: money(calculated.lines[index].taxableBase),
        tax: money(calculated.lines[index].taxTotal),
        total: money(calculated.lines[index].total)
      })),
      totals: {
        subtotal: money(calculated.subtotal),
        lineDiscount: money(calculated.lineDiscountTotal),
        globalDiscount: money(calculated.globalDiscountTotal),
        discountTotal: money(calculated.discountTotal),
        taxableBase: money(calculated.taxableBase),
        tax: money(calculated.taxTotal),
        total: money(calculated.total)
      },
      notes: source.notes ?? "",
      terms: source.terms ?? "",
      history: (source.history ?? []).map((entry) =>
        `${date(entry.createdAt)} - ${statusLabel(entry.newStatus, language)}`
      )
    };
  }

  private assertPersistenceParity(
    source: QuotationDocumentSource,
    calculated: QuotationMoneyResult
  ): void {
    assertPersistedQuotationMoneyParity(source, calculated);
  }

  render(viewModel: QuotationDocumentViewModel): Buffer {
    return renderQuotationDocument(viewModel);
  }
}

function formatExactMoney(value: string, currency: string, locale: Locale): string {
  if (moneyToMinorUnits(value, currency).startsWith("-")) throw new RangeError("Money values must be non-negative");
  return formatMoney(value, currency, numberLocale(locale));
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 42;
const CONTENT_BOTTOM = 58;
const TABLE_HEADER_HEIGHT = 22;
const TABLE_COLUMNS = [
  { x: 42, width: 50 },
  { x: 92, width: 240 },
  { x: 332, width: 80 },
  { x: 412, width: 141 }
] as const;

export function renderQuotationDocument(viewModel: QuotationDocumentViewModel): Buffer {
  const layout = buildQuotationDocumentLayout(viewModel);
  return createPdfDocument(layout.pages, {
    title: `${viewModel.quotation.title} ${viewModel.quotation.number} v${viewModel.quotation.version}`,
    author: viewModel.organization.name,
    subject: `${viewModel.client.name} - ${viewModel.totals.total}`,
    creator: "Kaklen QuotationDocumentService",
    createdAt: viewModel.generatedAt
  }, layout.logo ? { images: [layout.logo] } : {});
}

export interface QuotationDocumentLayout {
  pages: PdfCommand[][];
  logo: PdfImageResource | null;
}

export function buildQuotationDocumentLayout(
  viewModel: QuotationDocumentViewModel
): QuotationDocumentLayout {
  const labels = documentLabels(viewModel.locale);
  const pages: PdfCommand[][] = [];
  const logo = loadQuotationLogo();
  let page: PdfCommand[] = [];
  let y = 0;

  const startPage = (): void => {
    page = [];
    pages.push(page);
    if (logo) {
      const logoHeight = 48;
      const logoWidth = logoHeight * logo.width / logo.height;
      page.push({ kind: "image", name: logo.name, x: MARGIN, y: 780, width: logoWidth, height: logoHeight });
    } else {
      page.push({ kind: "text", x: MARGIN, y: 800, text: "KAKLEN", size: 18, bold: true });
    }
    const organizationLines = wrapTextToWidth(viewModel.organization.name, 340, 11, true);
    organizationLines.slice(0, 2).forEach((line, index) => {
      page.push({ kind: "text", x: 125, y: 807 - index * 13, text: line, size: 11, bold: true });
    });
    page.push({ kind: "line", x1: MARGIN, y1: 772, x2: PAGE_WIDTH - MARGIN, y2: 772, width: 1.4, gray: 0.25 });
    y = 748;
  };
  const ensure = (height: number): void => {
    if (y - height < CONTENT_BOTTOM) startPage();
  };
  const text = (value: string, x = MARGIN, size = 9, bold = false): void => {
    page.push({ kind: "text", x, y, text: value, size, bold });
  };
  const textAt = (value: string, x: number, lineY: number, size = 9, bold = false): void => {
    page.push({ kind: "text", x, y: lineY, text: value, size, bold });
  };
  const paragraph = (value: string, width = PAGE_WIDTH - MARGIN * 2, size = 9): void => {
    const lines = wrapTextToWidth(value, width, size);
    for (const line of lines.length ? lines : [""]) {
      ensure(15);
      text(line, MARGIN, size);
      y -= 13;
    }
  };

  startPage();
  text(`${viewModel.quotation.title} ${viewModel.quotation.number}`, MARGIN, 16, true);
  text(`${labels.version}: ${viewModel.quotation.version}`, 430, 9, true);
  y -= 24;
  text(`${labels.status}: ${viewModel.quotation.status}`, MARGIN, 9, true);
  text(`${labels.issueDate}: ${viewModel.quotation.issueDate}`, 265, 9);
  text(`${labels.validUntil}: ${viewModel.quotation.validUntil}`, 410, 9);
  y -= 22;

  const contactWidth = 237;
  const organizationContact = contactLines(
    viewModel.organization.legalName || viewModel.organization.name,
    joinParts([viewModel.organization.taxId, viewModel.organization.phone, viewModel.organization.whatsapp]),
    viewModel.organization.address,
    contactWidth
  );
  const clientContact = contactLines(
    viewModel.client.legalName || viewModel.client.name,
    joinParts([viewModel.client.taxId, viewModel.client.whatsapp, viewModel.client.email]),
    viewModel.client.address,
    contactWidth
  );
  const contactBlockHeight = Math.max(organizationContact.length, clientContact.length) * 11 + 31;
  ensure(contactBlockHeight + 8);
  const contactBlockTop = y;
  page.push({ kind: "rect", x: MARGIN, y: contactBlockTop - contactBlockHeight + 10, width: PAGE_WIDTH - MARGIN * 2, height: contactBlockHeight, gray: 0.95 });
  renderContactColumn(page, labels.organization, organizationContact, MARGIN + 8, contactBlockTop);
  renderContactColumn(page, labels.client, clientContact, 315, contactBlockTop);
  y -= contactBlockHeight + 6;
  text(`${labels.executive}: ${viewModel.quotation.executive}`, MARGIN, 8);
  y -= 24;

  text(labels.items, MARGIN, 11, true);
  y -= 18;
  renderTableHeader(page, y, labels);
  y -= TABLE_HEADER_HEIGHT;

  if (viewModel.items.length === 0) {
    text(labels.noItems, MARGIN, 9);
    y -= 20;
  }
  for (const item of viewModel.items) {
    const row = measureTableRow(item, labels);
    if (row.height > 650) {
      throw new RangeError(`Quotation row is too tall to fit on a page: ${item.code}`);
    }
    if (y - row.height < CONTENT_BOTTOM) {
      startPage();
      renderTableHeader(page, y, labels);
      y -= TABLE_HEADER_HEIGHT;
    }
    renderTableRow(page, y, row);
    y -= row.height;
  }

  ensure(142);
  const totalRows: Array<[string, string, boolean]> = [
    [labels.subtotal, viewModel.totals.subtotal, false],
    [labels.lineDiscount, viewModel.totals.lineDiscount, false],
    [labels.globalDiscount, viewModel.totals.globalDiscount, false],
    [labels.discountTotal, viewModel.totals.discountTotal, false],
    [labels.taxableBase, viewModel.totals.taxableBase, false],
    [labels.tax, viewModel.totals.tax, false],
    [labels.total, viewModel.totals.total, true]
  ];
  for (const [label, value, bold] of totalRows) {
    text(label, 365, bold ? 11 : 9, bold);
    const amount = bold ? `${value} ${viewModel.quotation.currency}` : value;
    textAt(amount, PAGE_WIDTH - MARGIN - measurePdfText(amount, bold ? 11 : 9, bold), y, bold ? 11 : 9, bold);
    y -= bold ? 18 : 15;
  }

  if (viewModel.notes) {
    ensure(45);
    text(labels.notes, MARGIN, 10, true);
    y -= 15;
    paragraph(viewModel.notes);
  }
  if (viewModel.terms) {
    ensure(45);
    text(labels.terms, MARGIN, 10, true);
    y -= 15;
    paragraph(viewModel.terms);
  }
  if (viewModel.history.length) {
    ensure(45);
    text(labels.history, MARGIN, 10, true);
    y -= 15;
    for (const entry of viewModel.history) {
      paragraph(entry, PAGE_WIDTH - MARGIN * 2, 8);
    }
  }

  pages.forEach((commands, index) => {
    commands.push({ kind: "line", x1: MARGIN, y1: 43, x2: PAGE_WIDTH - MARGIN, y2: 43, gray: 0.8 });
    commands.push({ kind: "text", x: MARGIN, y: 28, text: `${labels.generated}: ${localizedDateTime(viewModel.generatedAt, viewModel.locale)}`, size: 7 });
    commands.push({ kind: "text", x: 480, y: 28, text: `${labels.page} ${index + 1} ${labels.of} ${pages.length}`, size: 7 });
  });

  return { pages, logo };
}

function renderTableHeader(page: PdfCommand[], y: number, labels: ReturnType<typeof documentLabels>): void {
  page.push({ kind: "rect", x: MARGIN, y: y - 6, width: PAGE_WIDTH - MARGIN * 2, height: 18, gray: 0.91 });
  const headers = [labels.code, labels.productService, labels.quantity, labels.unitPrice];
  TABLE_COLUMNS.forEach((column, index) => {
    page.push({ kind: "text", x: column.x + 2, y, text: headers[index], size: 7, bold: true });
  });
}

interface MeasuredTableRow {
  item: QuotationDocumentItemViewModel;
  cells: string[][];
  nameLines: string[];
  descriptionLines: string[];
  mainHeight: number;
  financialHeight: number;
  financialRows: Array<{
    cells: Array<{ lines: string[]; emphasized: boolean }>;
    height: number;
  }>;
  height: number;
}

function measureTableRow(
  item: QuotationDocumentItemViewModel,
  labels: ReturnType<typeof documentLabels>
): MeasuredTableRow {
  const cells = [
    wrapTextToWidth(item.code, TABLE_COLUMNS[0].width - 4, 7.5),
    [],
    wrapTextToWidth(item.quantityAndUnit, TABLE_COLUMNS[2].width - 4, 7.5),
    wrapTextToWidth(item.unitPrice, TABLE_COLUMNS[3].width - 4, 7.5)
  ];
  const nameLines = wrapTextToWidth(item.name, TABLE_COLUMNS[1].width - 4, 8, true);
  const descriptionLines = wrapTextToWidth(item.description, TABLE_COLUMNS[1].width - 4, 7);
  const productHeight = nameLines.length * 10 + (descriptionLines.length ? 3 + descriptionLines.length * 9 : 0);
  const otherHeight = Math.max(...cells.map((lines) => Math.max(1, lines.length) * 10));
  const mainHeight = Math.max(productHeight, otherHeight) + 13;
  const financialFields: Array<[string, string, boolean]> = [
    [labels.subtotal, item.subtotal, false],
    [labels.lineDiscount, item.lineDiscount, false],
    [labels.allocatedGlobalDiscount, item.globalDiscount, false],
    [labels.discountTotal, item.discountTotal, false],
    [labels.taxableBase, item.taxableBase, false],
    [labels.tax, item.tax, false],
    [labels.lineTotal, item.total, true]
  ];
  const availableWidth = PAGE_WIDTH - MARGIN * 2;
  const financialRows = [
    financialFields.slice(0, 2),
    financialFields.slice(2, 4),
    financialFields.slice(4, 6),
    financialFields.slice(6)
  ].map((fields) => {
    const cellWidth = availableWidth / fields.length;
    const financialCells = fields.map(([label, value, emphasized]) => ({
      lines: wrapTextToWidth(`${label}: ${value}`, cellWidth - 12, emphasized ? 8 : 7.5, emphasized),
      emphasized
    }));
    return {
      cells: financialCells,
      height: Math.max(...financialCells.map((cell) => Math.max(1, cell.lines.length))) * 9 + 5
    };
  });
  const financialHeight = financialRows.reduce((sum, row) => sum + row.height, 0) + 5;
  return {
    item,
    cells,
    nameLines,
    descriptionLines,
    mainHeight,
    financialHeight,
    financialRows,
    height: mainHeight + financialHeight
  };
}

function renderTableRow(page: PdfCommand[], top: number, row: MeasuredTableRow): void {
  const baseline = top - 10;
  row.cells.forEach((lines, index) => {
    if (index === 1) return;
    lines.forEach((line, lineIndex) => {
      page.push({
        kind: "text",
        x: TABLE_COLUMNS[index].x + 2,
        y: baseline - lineIndex * 10,
        text: line,
        size: 7.5
      });
    });
  });
  let productY = baseline;
  row.nameLines.forEach((line) => {
    page.push({ kind: "text", x: TABLE_COLUMNS[1].x + 2, y: productY, text: line, size: 8, bold: true });
    productY -= 10;
  });
  if (row.descriptionLines.length) productY -= 3;
  row.descriptionLines.forEach((line) => {
    page.push({ kind: "text", x: TABLE_COLUMNS[1].x + 2, y: productY, text: line, size: 7 });
    productY -= 9;
  });
  page.push({
    kind: "rect",
    x: MARGIN,
    y: top - row.height + 4,
    width: PAGE_WIDTH - MARGIN * 2,
    height: row.financialHeight,
    gray: 0.97
  });
  let financialY = top - row.mainHeight - 7;
  const availableWidth = PAGE_WIDTH - MARGIN * 2;
  row.financialRows.forEach((financialRow) => {
    const cellWidth = availableWidth / financialRow.cells.length;
    financialRow.cells.forEach((cell, cellIndex) => {
      cell.lines.forEach((line, lineIndex) => {
        page.push({
          kind: "text",
          x: MARGIN + cellIndex * cellWidth + 4,
          y: financialY - lineIndex * 9,
          text: line,
          size: cell.emphasized ? 8 : 7.5,
          bold: cell.emphasized
        });
      });
    });
    financialY -= financialRow.height;
  });
  page.push({
    kind: "line",
    x1: MARGIN,
    y1: top - row.height + 4,
    x2: PAGE_WIDTH - MARGIN,
    y2: top - row.height + 4,
    gray: 0.85
  });
}

export function wrapTextToWidth(value: string, maxWidth: number, size: number, bold = false): string[] {
  const lines: string[] = [];
  for (const paragraph of value.replace(/\r\n/g, "\n").split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const pieces = splitWordToWidth(word, maxWidth, size, bold);
      for (const piece of pieces) {
        const candidate = line ? `${line} ${piece}` : piece;
        if (line && measurePdfText(candidate, size, bold) > maxWidth) {
          lines.push(line);
          line = piece;
        } else {
          line = candidate;
        }
      }
    }
    if (line) lines.push(line);
    if (!words.length && value.includes("\n")) lines.push("");
  }
  return lines;
}

function splitWordToWidth(word: string, maxWidth: number, size: number, bold: boolean): string[] {
  if (measurePdfText(word, size, bold) <= maxWidth) return [word];
  const pieces: string[] = [];
  let piece = "";
  for (const character of word) {
    const candidate = `${piece}${character}`;
    if (piece && measurePdfText(candidate, size, bold) > maxWidth) {
      pieces.push(piece);
      piece = character;
    } else {
      piece = candidate;
    }
  }
  if (piece) pieces.push(piece);
  return pieces;
}

interface ContactLine {
  text: string;
  size: number;
  bold: boolean;
}

function contactLines(name: string, contacts: string, address: string, width: number): ContactLine[] {
  return [
    ...wrapTextToWidth(name, width, 9, true).map((text) => ({ text, size: 9, bold: true })),
    ...wrapTextToWidth(contacts, width, 8).map((text) => ({ text, size: 8, bold: false })),
    ...wrapTextToWidth(address, width, 8).map((text) => ({ text, size: 8, bold: false }))
  ];
}

function renderContactColumn(
  page: PdfCommand[],
  heading: string,
  lines: readonly ContactLine[],
  x: number,
  top: number
): void {
  page.push({ kind: "text", x, y: top, text: heading, size: 10, bold: true });
  lines.forEach((line, index) => {
    page.push({ kind: "text", x, y: top - 16 - index * 11, text: line.text, size: line.size, bold: line.bold });
  });
}

let cachedQuotationLogo: PdfImageResource | null | undefined;

function loadQuotationLogo(): PdfImageResource | null {
  if (cachedQuotationLogo !== undefined) return cachedQuotationLogo;
  const path = resolveQuotationLogoPath();
  if (!path) {
    if (process.env.CI === "true" || process.env.NODE_ENV === "production") {
      throw new Error("Official quotation logo asset is missing");
    }
    cachedQuotationLogo = null;
    return cachedQuotationLogo;
  }
  cachedQuotationLogo = loadPngImage(path, "KaklenLogo");
  return cachedQuotationLogo;
}

export function resolveQuotationLogoPath(): string | null {
  const candidates = [
    resolve(process.cwd(), "apps/web/public/brand/logo-kaklen.png"),
    resolve(process.cwd(), "../web/public/brand/logo-kaklen.png"),
    resolve(__dirname, "../../../web/public/brand/logo-kaklen.png")
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function joinParts(parts: string[]): string {
  return parts.filter(Boolean).join(" · ");
}

function normalizeLocale(value: string): Locale {
  return value === "en" || value === "pt-BR" ? value : "es";
}

function numberLocale(locale: Locale): string {
  return locale === "es" ? "es-CL" : locale;
}

function localizedDateTime(value: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(numberLocale(locale), { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function statusLabel(status: QuotationStatus, locale: Locale): string {
  const labels: Record<Locale, Record<QuotationStatus, string>> = {
    es: { DRAFT: "Borrador", SENT: "Enviada", CHANGES_REQUESTED: "Cambios solicitados", APPROVED: "Aprobada", REJECTED: "Rechazada", EXPIRED: "Expirada", CANCELLED: "Cancelada" },
    en: { DRAFT: "Draft", SENT: "Sent", CHANGES_REQUESTED: "Changes requested", APPROVED: "Approved", REJECTED: "Rejected", EXPIRED: "Expired", CANCELLED: "Cancelled" },
    "pt-BR": { DRAFT: "Rascunho", SENT: "Enviada", CHANGES_REQUESTED: "Alterações solicitadas", APPROVED: "Aprovada", REJECTED: "Rejeitada", EXPIRED: "Expirada", CANCELLED: "Cancelada" }
  };
  return labels[locale][status];
}

function documentLabels(locale: Locale) {
  const labels = {
    es: {
      quotation: "Cotización", version: "Versión", status: "Estado", issueDate: "Emisión", validUntil: "Vigencia",
      organization: "Empresa", client: "Cliente", executive: "Ejecutivo", items: "Detalle", noItems: "Sin ítems",
      code: "Código", description: "Descripción", productService: "Producto o servicio", quantity: "Cantidad", unitPrice: "Precio", discount: "Descuento", tax: "IVA", total: "Total",
      subtotal: "Subtotal neto", lineDiscount: "Descuento por línea", allocatedGlobalDiscount: "Descuento global asignado", globalDiscount: "Descuento global", discountTotal: "Descuento total", taxableBase: "Base imponible", lineTotal: "Total línea, IVA incluido",
      notes: "Notas", terms: "Términos", history: "Historial", generated: "Generado", page: "Página", of: "de"
    },
    en: {
      quotation: "Quotation", version: "Version", status: "Status", issueDate: "Issue date", validUntil: "Valid until",
      organization: "Company", client: "Client", executive: "Executive", items: "Details", noItems: "No items",
      code: "Code", description: "Description", productService: "Product or service", quantity: "Quantity", unitPrice: "Price", discount: "Discount", tax: "VAT", total: "Total",
      subtotal: "Net subtotal", lineDiscount: "Line discount", allocatedGlobalDiscount: "Allocated global discount", globalDiscount: "Global discount", discountTotal: "Total discount", taxableBase: "Taxable base", lineTotal: "Line total, VAT included",
      notes: "Notes", terms: "Terms", history: "History", generated: "Generated", page: "Page", of: "of"
    },
    "pt-BR": {
      quotation: "Cotação", version: "Versão", status: "Status", issueDate: "Emissão", validUntil: "Válida até",
      organization: "Empresa", client: "Cliente", executive: "Executivo", items: "Detalhes", noItems: "Sem itens",
      code: "Código", description: "Descrição", productService: "Produto ou serviço", quantity: "Quantidade", unitPrice: "Preço", discount: "Desconto", tax: "IVA", total: "Total",
      subtotal: "Subtotal líquido", lineDiscount: "Desconto por item", allocatedGlobalDiscount: "Desconto global rateado", globalDiscount: "Desconto global", discountTotal: "Desconto total", taxableBase: "Base tributável", lineTotal: "Total do item, IVA incluído",
      notes: "Notas", terms: "Termos", history: "Histórico", generated: "Gerado", page: "Página", of: "de"
    }
  };
  return labels[locale];
}
