import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { QuotationDiscountType, QuotationStatus } from "@prisma/client";
import { calculateQuotationMoney, formatMoney, moneyToMinorUnits } from "@kaklen/shared";
import type { QuotationMoneyResult } from "@kaklen/shared";
import { createPdfDocument, PdfCommand } from "./pdf";

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
  lineDiscount: string;
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
  private readonly logger = new Logger(QuotationDocumentService.name);

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
        lineDiscount: money(calculated.lines[index].lineDiscountTotal),
        tax: `${item.taxPercent.toString()}%`,
        total: money(calculated.lines[index].total)
      })),
      totals: {
        subtotal: money(calculated.subtotal),
        lineDiscount: money(calculated.lineDiscountTotal),
        globalDiscount: money(calculated.globalDiscountTotal),
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

  private assertPersistenceParity(source: QuotationDocumentSource, calculated: QuotationMoneyResult): void {
    const comparisons: Array<[string, string, DecimalValue]> = [
      ["subtotal", calculated.subtotal, source.subtotal],
      ["discountTotal", calculated.discountTotal, source.discountTotal],
      ["taxTotal", calculated.taxTotal, source.taxTotal],
      ["total", calculated.total, source.total]
    ];
    source.items.forEach((item, index) => {
      const line = calculated.lines[index];
      comparisons.push(
        [`items.${index}.subtotal`, line.subtotal, item.subtotal],
        [`items.${index}.discountTotal`, line.discountTotal, item.discountTotal],
        [`items.${index}.taxTotal`, line.taxTotal, item.taxTotal],
        [`items.${index}.total`, line.total, item.total]
      );
    });
    const mismatch = comparisons.find(([, expected, persisted]) =>
      moneyToMinorUnits(expected, source.currency) !== moneyToMinorUnits(persisted.toString(), source.currency)
    );
    if (!mismatch) return;

    const [field, expected, persisted] = mismatch;
    this.logger.error(
      `Quotation money mismatch number=${source.number} field=${field} expectedMinor=${moneyToMinorUnits(expected, source.currency)} persistedMinor=${moneyToMinorUnits(persisted.toString(), source.currency)}`
    );
    throw new ConflictException({
      code: "QUOTATION_MONEY_MISMATCH",
      message: "Quotation totals are inconsistent. Recalculate and save before generating the document."
    });
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

export function renderQuotationDocument(viewModel: QuotationDocumentViewModel): Buffer {
  const labels = documentLabels(viewModel.locale);
  const pages: PdfCommand[][] = [];
  let page: PdfCommand[] = [];
  let y = 0;

  const startPage = (): void => {
    page = [];
    pages.push(page);
    page.push({ kind: "text", x: MARGIN, y: 796, text: "KAKLEN", size: 18, bold: true });
    page.push({ kind: "text", x: 135, y: 798, text: viewModel.organization.name, size: 11, bold: true });
    page.push({ kind: "line", x1: MARGIN, y1: 785, x2: PAGE_WIDTH - MARGIN, y2: 785, width: 1.4, gray: 0.25 });
    y = 762;
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
  const paragraph = (value: string, width = 88, size = 9): void => {
    const lines = wrapText(value, width);
    ensure(Math.max(1, lines.length) * 13 + 4);
    for (const line of lines.length ? lines : [""]) {
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

  const contactBlockTop = y;
  page.push({ kind: "rect", x: MARGIN, y: contactBlockTop - 60, width: PAGE_WIDTH - MARGIN * 2, height: 72, gray: 0.95 });
  textAt(labels.organization, MARGIN + 8, contactBlockTop, 10, true);
  textAt(truncate(viewModel.organization.legalName || viewModel.organization.name, 44), MARGIN + 8, contactBlockTop - 16, 9);
  textAt(truncate(joinParts([viewModel.organization.taxId, viewModel.organization.phone, viewModel.organization.whatsapp]), 57), MARGIN + 8, contactBlockTop - 31, 8);
  textAt(truncate(viewModel.organization.address, 57), MARGIN + 8, contactBlockTop - 46, 8);
  textAt(labels.client, 315, contactBlockTop, 10, true);
  textAt(truncate(viewModel.client.legalName || viewModel.client.name, 39), 315, contactBlockTop - 16, 9);
  textAt(truncate(joinParts([viewModel.client.taxId, viewModel.client.whatsapp, viewModel.client.email]), 50), 315, contactBlockTop - 31, 8);
  textAt(truncate(viewModel.client.address, 50), 315, contactBlockTop - 46, 8);
  y -= 82;
  text(`${labels.executive}: ${viewModel.quotation.executive}`, MARGIN, 8);
  y -= 24;

  text(labels.items, MARGIN, 11, true);
  y -= 18;
  renderTableHeader(page, y, labels);
  y -= 22;

  if (viewModel.items.length === 0) {
    text(labels.noItems, MARGIN, 9);
    y -= 20;
  }
  for (const item of viewModel.items) {
    const descriptionLines = wrapText(item.description, 82);
    const rowHeight = 25 + descriptionLines.length * 11;
    ensure(rowHeight + 24);
    if (y > 730) {
      renderTableHeader(page, y, labels);
      y -= 22;
    }
    text(item.code, MARGIN, 8);
    text(truncate(item.name, 33), 88, 8, true);
    text(item.quantityAndUnit, 285, 8);
    text(item.unitPrice, 350, 8);
    text(item.lineDiscount, 420, 8);
    text(item.tax, 480, 8);
    text(item.total, 515, 8);
    y -= 13;
    for (const line of descriptionLines) {
      text(line, 88, 7);
      y -= 11;
    }
    page.push({ kind: "line", x1: MARGIN, y1: y + 4, x2: PAGE_WIDTH - MARGIN, y2: y + 4, gray: 0.85 });
    y -= 10;
  }

  ensure(118);
  const totalRows: Array<[string, string, boolean]> = [
    [labels.subtotal, viewModel.totals.subtotal, false],
    [labels.lineDiscount, viewModel.totals.lineDiscount, false],
    [labels.globalDiscount, viewModel.totals.globalDiscount, false],
    [labels.taxableBase, viewModel.totals.taxableBase, false],
    [labels.tax, viewModel.totals.tax, false],
    [labels.total, `${viewModel.totals.total} ${viewModel.quotation.currency}`, true]
  ];
  for (const [label, value, bold] of totalRows) {
    text(label, 365, bold ? 11 : 9, bold);
    text(value, 470, bold ? 11 : 9, bold);
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
      ensure(15);
      text(entry, MARGIN, 8);
      y -= 13;
    }
  }

  pages.forEach((commands, index) => {
    commands.push({ kind: "line", x1: MARGIN, y1: 43, x2: PAGE_WIDTH - MARGIN, y2: 43, gray: 0.8 });
    commands.push({ kind: "text", x: MARGIN, y: 28, text: `${labels.generated}: ${localizedDateTime(viewModel.generatedAt, viewModel.locale)}`, size: 7 });
    commands.push({ kind: "text", x: 480, y: 28, text: `${labels.page} ${index + 1} ${labels.of} ${pages.length}`, size: 7 });
  });

  return createPdfDocument(pages, {
    title: `${viewModel.quotation.title} ${viewModel.quotation.number} v${viewModel.quotation.version}`,
    author: viewModel.organization.name,
    subject: `${viewModel.client.name} - ${viewModel.totals.total}`,
    creator: "Kaklen QuotationDocumentService",
    createdAt: viewModel.generatedAt
  });
}

function renderTableHeader(page: PdfCommand[], y: number, labels: ReturnType<typeof documentLabels>): void {
  page.push({ kind: "rect", x: MARGIN, y: y - 6, width: PAGE_WIDTH - MARGIN * 2, height: 18, gray: 0.91 });
  const headers: Array<[number, string]> = [
    [MARGIN, labels.code], [88, labels.description], [285, labels.quantity], [350, labels.unitPrice],
    [420, labels.discount], [480, labels.tax], [515, labels.total]
  ];
  headers.forEach(([x, label]) => page.push({ kind: "text", x, y, text: label, size: 7, bold: true }));
}

function wrapText(value: string, maxCharacters: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const pieces = word.length > maxCharacters
      ? word.match(new RegExp(`.{1,${maxCharacters}}`, "g")) ?? [word]
      : [word];
    for (const piece of pieces) {
      const candidate = line ? `${line} ${piece}` : piece;
      if (candidate.length > maxCharacters && line) {
        lines.push(line);
        line = piece;
      } else {
        line = candidate;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
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
      code: "Código", description: "Descripción", quantity: "Cantidad", unitPrice: "Precio", discount: "Desc.", tax: "IVA", total: "Total",
      subtotal: "Subtotal", lineDiscount: "Descuento por línea", globalDiscount: "Descuento global", taxableBase: "Base imponible",
      notes: "Notas", terms: "Términos", history: "Historial", generated: "Generado", page: "Página", of: "de"
    },
    en: {
      quotation: "Quotation", version: "Version", status: "Status", issueDate: "Issue date", validUntil: "Valid until",
      organization: "Company", client: "Client", executive: "Executive", items: "Details", noItems: "No items",
      code: "Code", description: "Description", quantity: "Quantity", unitPrice: "Price", discount: "Disc.", tax: "Tax", total: "Total",
      subtotal: "Subtotal", lineDiscount: "Line discount", globalDiscount: "Global discount", taxableBase: "Taxable base",
      notes: "Notes", terms: "Terms", history: "History", generated: "Generated", page: "Page", of: "of"
    },
    "pt-BR": {
      quotation: "Cotação", version: "Versão", status: "Status", issueDate: "Emissão", validUntil: "Válida até",
      organization: "Empresa", client: "Cliente", executive: "Executivo", items: "Detalhes", noItems: "Sem itens",
      code: "Código", description: "Descrição", quantity: "Quantidade", unitPrice: "Preço", discount: "Desc.", tax: "Imposto", total: "Total",
      subtotal: "Subtotal", lineDiscount: "Desconto por item", globalDiscount: "Desconto global", taxableBase: "Base tributável",
      notes: "Notas", terms: "Termos", history: "Histórico", generated: "Gerado", page: "Página", of: "de"
    }
  };
  return labels[locale];
}
