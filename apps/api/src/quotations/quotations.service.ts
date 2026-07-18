import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional, ServiceUnavailableException } from "@nestjs/common";
import {
  CatalogItem,
  Client,
  Organization,
  Prisma,
  Quotation,
  QuotationDiscountType,
  QuotationItem,
  QuotationItemType,
  QuotationStatus,
  QuotationStatusHistory
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { calculateQuotationMoney, MoneyPrecisionError, parseMoney } from "@kaklen/shared";
import type { QuotationDecimalInput, QuotationMoneyAmounts } from "@kaklen/shared";
import { MailService } from "../notifications/mail.service";
import { normalizeNotificationLocale, renderQuotationEmail } from "../notifications/templates";
import {
  ChangeQuotationStatusDto,
  CreateQuotationDto,
  ListQuotationsQueryDto,
  QuotationItemInputDto,
  SendQuotationEmailDto,
  UpdateQuotationDto
} from "./dto/quotation.dto";
import { QuotationDocumentService } from "./quotation-document.service";
import { calculateConsistentQuotationMoney } from "./quotation-money-consistency";

type QuotationWithDetails = Quotation & {
  client: Client;
  items: QuotationItem[];
  history?: QuotationStatusHistory[];
  organization?: Organization;
  createdBy?: { firstName: string; lastName: string };
};

interface CalculatedItem {
  catalogItemId: string | null;
  type: QuotationItemType;
  code: string | null;
  name: string;
  description: string | null;
  quantity: Prisma.Decimal;
  unit: string;
  unitPrice: Prisma.Decimal;
  discountType: QuotationDiscountType;
  discountValue: Prisma.Decimal;
  taxPercent: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  sortOrder: number;
}

type QuotationCalculationItem = Omit<
  QuotationItemInputDto,
  "quantity" | "unitPrice" | "discountValue" | "taxPercent"
> & {
  quantity: QuotationDecimalInput;
  unitPrice: QuotationDecimalInput;
  discountValue?: QuotationDecimalInput;
  taxPercent: QuotationDecimalInput;
};

interface CalculatedTotals {
  items: CalculatedItem[];
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
}

export interface PaginatedQuotations {
  items: QuotationWithDetails[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface QuotationSummary {
  total: number;
  draft: number;
  sent: number;
  changesRequested: number;
  approved: number;
  rejected: number;
  expired: number;
  cancelled: number;
  baseCurrency: string;
  approvedAmounts: Array<{ currency: string; amount: string; quotationCount: number }>;
  baseCurrencyApprovedAmount: string;
}

export interface QuotationPdfDocument {
  buffer: Buffer;
  filename: string;
}

export type QuotationHistoryView = QuotationStatusHistory & {
  changedBy: Pick<Prisma.UserGetPayload<object>, "firstName" | "lastName"> | null;
};

export interface QuotationChangeRequestView {
  id: string;
  quotationId: string;
  quotationVersion: number;
  comment: string;
  itemIndexes: number[];
  items: Array<{ index: number; name: string; code: string | null }>;
  createdAt: string;
}

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly mailService?: MailService,
    @Optional() private readonly quotationDocumentService?: QuotationDocumentService
  ) {}

  async create(organizationId: string, userId: string, dto: CreateQuotationDto): Promise<QuotationWithDetails> {
    this.assertDates(dto.issueDate, dto.validUntil);
    await this.ensureClientBelongsToOrganization(organizationId, dto.clientId);

    return this.prisma.$transaction(async (tx) => {
      const organization = await this.findOrganization(organizationId, tx);
      const currency = this.clean(dto.currency)?.toUpperCase() ?? organization.currency;
      const totals = await this.calculateItems(organizationId, dto.items, dto.globalDiscountPercent ?? 0, currency, tx);
      const number = await this.nextNumber(organizationId, tx);
      const quotation = await tx.quotation.create({
        data: {
          organizationId,
          clientId: dto.clientId,
          number,
          issueDate: new Date(dto.issueDate),
          validUntil: new Date(dto.validUntil),
          currency,
          globalDiscountPercent: new Prisma.Decimal(dto.globalDiscountPercent ?? 0),
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          notes: this.clean(dto.notes),
          terms: this.clean(dto.terms),
          createdByUserId: userId,
          items: { create: totals.items }
        }
      });
      await this.recordStatus(tx, organizationId, quotation.id, null, quotation.status, userId, "quotation.created");
      await this.audit(tx, organizationId, userId, "quotation.created", quotation.id);
      return this.findQuotation(organizationId, quotation.id, tx);
    });
  }

  async list(organizationId: string, query: ListQuotationsQueryDto): Promise<PaginatedQuotations> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(organizationId, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.quotation.findMany({
        where,
        include: { client: true, items: { orderBy: { sortOrder: "asc" } } },
        orderBy: { [query.sortBy ?? "createdAt"]: query.sortDirection ?? "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.quotation.count({ where })
    ]);
    return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  async summary(organizationId: string): Promise<QuotationSummary> {
    const [grouped, approvedByCurrency, organization] = await this.prisma.$transaction([
      this.prisma.quotation.groupBy({
        by: ["status"],
        where: { organizationId, archivedAt: null },
        _count: { _all: true },
        orderBy: { status: "asc" }
      }),
      this.prisma.quotation.groupBy({
        by: ["currency"],
        where: { organizationId, archivedAt: null, status: QuotationStatus.APPROVED },
        _sum: { total: true },
        _count: { _all: true },
        orderBy: { currency: "asc" }
      }),
      this.prisma.organization.findFirst({ where: { id: organizationId }, select: { currency: true } })
    ]);
    const count = (status: QuotationStatus): number => {
      const item = grouped.find((group) => group.status === status);
      return typeof item?._count === "object" ? item._count._all ?? 0 : 0;
    };
    const baseCurrency = (organization?.currency ?? "CLP").toUpperCase();
    const approvedAmounts = approvedByCurrency
      .map((group) => ({
        currency: group.currency.toUpperCase(),
        amount: parseMoney((group._sum?.total ?? new Prisma.Decimal(0)).toString(), group.currency),
        quotationCount: typeof group._count === "object" ? group._count._all ?? 0 : 0
      }))
      .sort((left, right) => {
        if (left.currency === baseCurrency) return -1;
        if (right.currency === baseCurrency) return 1;
        return left.currency.localeCompare(right.currency);
      });
    return {
      total: grouped.reduce((sum, item) => sum + (typeof item._count === "object" ? item._count._all ?? 0 : 0), 0),
      draft: count(QuotationStatus.DRAFT),
      sent: count(QuotationStatus.SENT),
      changesRequested: count(QuotationStatus.CHANGES_REQUESTED),
      approved: count(QuotationStatus.APPROVED),
      rejected: count(QuotationStatus.REJECTED),
      expired: count(QuotationStatus.EXPIRED),
      cancelled: count(QuotationStatus.CANCELLED),
      baseCurrency,
      approvedAmounts,
      baseCurrencyApprovedAmount: approvedAmounts.find((item) => item.currency === baseCurrency)?.amount ??
        parseMoney("0", baseCurrency),
    };
  }

  async get(organizationId: string, quotationId: string): Promise<QuotationWithDetails> {
    const quotation = await this.findQuotation(organizationId, quotationId, this.prisma);
    calculateConsistentQuotationMoney(quotation);
    return quotation;
  }

  async update(
    organizationId: string,
    quotationId: string,
    userId: string,
    dto: UpdateQuotationDto
  ): Promise<QuotationWithDetails> {
    const existing = await this.findQuotation(organizationId, quotationId, this.prisma);
    if (existing.status !== QuotationStatus.DRAFT) {
      throw new ForbiddenException("Only draft quotations can be edited");
    }
    const issueDate = dto.issueDate ?? existing.issueDate.toISOString();
    const validUntil = dto.validUntil ?? existing.validUntil.toISOString();
    this.assertDates(issueDate, validUntil);
    if (dto.clientId) {
      await this.ensureClientBelongsToOrganization(organizationId, dto.clientId);
    }

    return this.prisma.$transaction(async (tx) => {
      const shouldRecalculate = dto.items !== undefined || dto.globalDiscountPercent !== undefined || dto.currency !== undefined;
      const currency = dto.currency?.trim().toUpperCase() ?? existing.currency;
      const calculationItems = dto.items ?? existing.items.map((item) => ({
        catalogItemId: item.catalogItemId ?? undefined,
        type: item.type,
        code: item.code ?? undefined,
        name: item.name,
        description: item.description ?? undefined,
        quantity: item.quantity.toString(),
        unit: item.unit,
        unitPrice: item.unitPrice.toString(),
        discountType: item.discountType,
        discountValue: item.discountValue.toString(),
        taxPercent: item.taxPercent.toString()
      }));
      const globalDiscountPercent = dto.globalDiscountPercent ?? existing.globalDiscountPercent.toString();
      const totals = shouldRecalculate
        ? await this.calculateItems(organizationId, calculationItems, globalDiscountPercent, currency, tx)
        : null;
      if (totals) {
        await tx.quotationItem.deleteMany({ where: { quotationId } });
      }
      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          clientId: dto.clientId,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          currency: dto.currency === undefined ? undefined : currency,
          globalDiscountPercent: dto.globalDiscountPercent === undefined ? undefined : new Prisma.Decimal(dto.globalDiscountPercent),
          notes: dto.notes === undefined ? undefined : this.clean(dto.notes),
          terms: dto.terms === undefined ? undefined : this.clean(dto.terms),
          ...(totals
            ? {
                subtotal: totals.subtotal,
                discountTotal: totals.discountTotal,
                taxTotal: totals.taxTotal,
                total: totals.total,
                items: { create: totals.items }
              }
            : {})
        }
      });
      await this.audit(tx, organizationId, userId, "quotation.updated", quotationId);
      return this.findQuotation(organizationId, quotationId, tx);
    });
  }

  async archive(organizationId: string, quotationId: string, userId: string): Promise<void> {
    await this.findQuotation(organizationId, quotationId, this.prisma);
    await this.prisma.$transaction(async (tx) => {
      await tx.quotation.update({ where: { id: quotationId }, data: { archivedAt: new Date() } });
      await this.audit(tx, organizationId, userId, "quotation.archived", quotationId);
    });
  }

  async send(organizationId: string, quotationId: string, userId: string, dto: ChangeQuotationStatusDto): Promise<QuotationWithDetails> {
    return this.changeStatus(organizationId, quotationId, userId, QuotationStatus.SENT, dto.note);
  }

  async approve(organizationId: string, quotationId: string, userId: string, dto: ChangeQuotationStatusDto): Promise<QuotationWithDetails> {
    return this.changeStatus(organizationId, quotationId, userId, QuotationStatus.APPROVED, dto.note);
  }

  async reject(organizationId: string, quotationId: string, userId: string, dto: ChangeQuotationStatusDto): Promise<QuotationWithDetails> {
    return this.changeStatus(organizationId, quotationId, userId, QuotationStatus.REJECTED, dto.note);
  }

  async cancel(organizationId: string, quotationId: string, userId: string, dto: ChangeQuotationStatusDto): Promise<QuotationWithDetails> {
    return this.changeStatus(organizationId, quotationId, userId, QuotationStatus.CANCELLED, dto.note);
  }

  async newVersion(organizationId: string, quotationId: string, userId: string): Promise<QuotationWithDetails> {
    const existing = await this.findQuotation(organizationId, quotationId, this.prisma);
    const versionableStatuses: QuotationStatus[] = [
      QuotationStatus.APPROVED,
      QuotationStatus.REJECTED,
      QuotationStatus.SENT,
      QuotationStatus.CHANGES_REQUESTED,
      QuotationStatus.CANCELLED
    ];
    if (!versionableStatuses.includes(existing.status)) {
      throw new BadRequestException("Quotation cannot create a new version from its current status");
    }
    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.quotation.findFirst({
        where: { organizationId, number: existing.number },
        orderBy: { version: "desc" }
      });
      const quotation = await tx.quotation.create({
        data: {
          organizationId,
          clientId: existing.clientId,
          number: existing.number,
          version: (latest?.version ?? existing.version) + 1,
          status: QuotationStatus.DRAFT,
          issueDate: new Date(),
          validUntil: existing.validUntil,
          currency: existing.currency,
          globalDiscountPercent: existing.globalDiscountPercent,
          subtotal: existing.subtotal,
          discountTotal: existing.discountTotal,
          taxTotal: existing.taxTotal,
          total: existing.total,
          notes: existing.notes,
          terms: existing.terms,
          createdByUserId: userId,
          items: {
            create: existing.items.map((item) => ({
              catalogItemId: item.catalogItemId,
              type: item.type,
              code: item.code,
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              discountType: item.discountType,
              discountValue: item.discountValue,
              taxPercent: item.taxPercent,
              subtotal: item.subtotal,
              discountTotal: item.discountTotal,
              taxTotal: item.taxTotal,
              total: item.total,
              sortOrder: item.sortOrder
            }))
          }
        }
      });
      await this.recordStatus(tx, organizationId, quotation.id, null, QuotationStatus.DRAFT, userId, "quotation.version.created");
      await this.audit(tx, organizationId, userId, "quotation.version.created", quotation.id);
      return this.findQuotation(organizationId, quotation.id, tx);
    });
  }

  async history(organizationId: string, quotationId: string): Promise<QuotationHistoryView[]> {
    await this.findQuotation(organizationId, quotationId, this.prisma);
    return this.prisma.quotationStatusHistory.findMany({
      where: { organizationId, quotationId },
      include: { changedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" }
    });
  }

  async changeRequests(
    organizationId: string,
    quotationId: string
  ): Promise<QuotationChangeRequestView[]> {
    const quotation = await this.findQuotation(organizationId, quotationId, this.prisma);
    const requests = await this.prisma.quotationChangeRequest.findMany({
      where: {
        organizationId,
        quotation: { number: quotation.number }
      },
      orderBy: { createdAt: "desc" },
      include: {
        quotation: {
          select: {
            version: true,
            items: {
              orderBy: { sortOrder: "asc" },
              select: { name: true, code: true }
            }
          }
        }
      }
    });
    return requests.map((request) => {
      const itemIndexes = this.changeRequestItemIndexes(
        request.itemIndexes,
        request.quotation.items.length
      );
      return {
        id: request.id,
        quotationId: request.quotationId,
        quotationVersion: request.quotation.version,
        comment: request.comment,
        itemIndexes,
        items: itemIndexes.flatMap((index) => {
          const item = request.quotation.items[index];
          return item ? [{ index, name: item.name, code: item.code }] : [];
        }),
        createdAt: request.createdAt.toISOString()
      };
    });
  }

  async pdf(organizationId: string, quotationId: string, locale: string): Promise<Buffer> {
    return (await this.pdfDocument(organizationId, quotationId, locale)).buffer;
  }

  async pdfDocument(organizationId: string, quotationId: string, locale: string): Promise<QuotationPdfDocument> {
    const quotation = await this.findQuotation(organizationId, quotationId, this.prisma, true);
    return this.renderPdfDocument(quotation, locale);
  }

  async sendEmail(
    organizationId: string,
    quotationId: string,
    userId: string,
    dto: SendQuotationEmailDto
  ): Promise<QuotationWithDetails> {
    const quotation = await this.findQuotation(organizationId, quotationId, this.prisma, true);
    if (!this.mailService?.isCommercialEmailEnabled()) {
      throw new ServiceUnavailableException({
        code: "COMMERCIAL_EMAIL_DISABLED",
        message: "Commercial email delivery is disabled"
      });
    }
    if (quotation.status !== QuotationStatus.DRAFT && quotation.status !== QuotationStatus.SENT) {
      throw new BadRequestException("Quotation cannot be emailed from its current status");
    }
    const locale = normalizeNotificationLocale(dto.locale);
    const document = this.renderPdfDocument(quotation, locale);
    const content = renderQuotationEmail(locale, {
      organizationName: quotation.organization?.name ?? "Kaklen",
      quotationNumber: `${quotation.number} v${quotation.version}`,
      clientName: quotation.client.displayName,
      message: dto.message.trim()
    });

    await this.mailService.send({
      mailType: "quotation",
      locale,
      to: dto.to.trim().toLowerCase(),
      subject: dto.subject.trim(),
      text: content.text,
      html: content.html,
      attachments: [{ filename: document.filename, content: document.buffer, contentType: "application/pdf" }]
    });

    return this.prisma.$transaction(async (tx) => {
      const nextStatus = QuotationStatus.SENT;
      if (quotation.status === QuotationStatus.DRAFT) {
        await tx.quotation.update({
          where: { id: quotationId },
          data: { status: nextStatus, sentAt: new Date() }
        });
      }
      await this.recordStatus(
        tx,
        organizationId,
        quotationId,
        quotation.status,
        nextStatus,
        userId,
        `quotation.email.sent|${dto.to.trim().toLowerCase()}`
      );
      const recipientDomain = dto.to.trim().toLowerCase().split("@")[1] ?? "unknown";
      await this.audit(tx, organizationId, userId, "quotation.email.sent", quotationId, { recipientDomain });
      return this.findQuotation(organizationId, quotationId, tx);
    });
  }

  private renderPdfDocument(quotation: QuotationWithDetails, locale: string): QuotationPdfDocument {
    const language = normalizeNotificationLocale(locale);
    const service = this.quotationDocumentService ?? new QuotationDocumentService();
    const buffer = service.render(service.buildViewModel(quotation, language));
    const prefix = language === "en" ? "quotation" : language === "pt-BR" ? "cotacao" : "cotizacion";
    const safeNumber = quotation.number.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    return { buffer, filename: `${prefix}-${safeNumber}-v${quotation.version}.pdf` };
  }

  calculateQuotationItems(
    items: readonly QuotationCalculationItem[],
    catalogItems?: Map<string, CatalogItem>,
    globalDiscountPercent?: QuotationDecimalInput,
    currency?: string
  ): CalculatedTotals;
  calculateQuotationItems(
    items: QuotationItemInputDto[],
    catalogItems?: Map<string, CatalogItem>,
    globalDiscountPercent?: QuotationDecimalInput,
    currency?: string
  ): CalculatedTotals;
  calculateQuotationItems(
    items: readonly QuotationCalculationItem[],
    catalogItems = new Map<string, CatalogItem>(),
    globalDiscountPercent: QuotationDecimalInput = 0,
    currency = "USD"
  ): CalculatedTotals {
    const resolvedItems = items.map((item, index) => {
      const catalogItem = catalogItems.get(item.catalogItemId ?? "");
      const quantity = new Prisma.Decimal(item.quantity);
      const unitPrice = new Prisma.Decimal(catalogItem?.price ?? item.unitPrice);
      const discountType = item.discountType ?? QuotationDiscountType.NONE;
      const discountValue = new Prisma.Decimal(item.discountValue ?? 0);
      const taxPercent = new Prisma.Decimal(catalogItem?.taxPercent ?? item.taxPercent);
      return { item, index, catalogItem, quantity, unitPrice, discountType, discountValue, taxPercent };
    });
    let calculatedAmounts: QuotationMoneyAmounts[];
    try {
      calculatedAmounts = calculateQuotationMoney(
        resolvedItems.map((resolved) => ({
          quantity: resolved.quantity.toString(),
          unitPrice: resolved.unitPrice.toString(),
          discountType: resolved.discountType,
          discountValue: resolved.discountValue.toString(),
          taxPercent: resolved.taxPercent.toString()
        })),
        globalDiscountPercent,
        { currency }
      ).lines;
    } catch (error) {
      throw new BadRequestException({
        code: error instanceof MoneyPrecisionError ? error.code : "QUOTATION_AMOUNTS_INVALID",
        message: error instanceof Error ? error.message : "Invalid quotation amounts"
      });
    }
    const calculatedItems = resolvedItems.map((resolved) =>
      this.mapCalculatedItem(resolved, calculatedAmounts[resolved.index])
    );
    return {
      items: calculatedItems,
      subtotal: this.sum(calculatedItems.map((item) => item.subtotal)),
      discountTotal: this.sum(calculatedItems.map((item) => item.discountTotal)),
      taxTotal: this.sum(calculatedItems.map((item) => item.taxTotal)),
      total: this.sum(calculatedItems.map((item) => item.total))
    };
  }

  private async calculateItems(
    organizationId: string,
    items: readonly QuotationCalculationItem[],
    globalDiscountPercent: QuotationDecimalInput,
    currency: string,
    tx: Prisma.TransactionClient
  ): Promise<CalculatedTotals> {
    const catalogIds = items.map((item) => item.catalogItemId).filter((item): item is string => Boolean(item));
    const catalogItems = catalogIds.length
      ? await tx.catalogItem.findMany({ where: { organizationId, id: { in: catalogIds } } })
      : [];
    if (catalogItems.length !== new Set(catalogIds).size) {
      throw new BadRequestException("Catalog item does not belong to this organization");
    }
    return this.calculateQuotationItems(
      items,
      new Map(catalogItems.map((item) => [item.id, item])),
      globalDiscountPercent,
      currency
    );
  }

  private mapCalculatedItem(
    resolved: {
      item: QuotationCalculationItem;
      index: number;
      catalogItem: CatalogItem | undefined;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      discountType: QuotationDiscountType;
      discountValue: Prisma.Decimal;
      taxPercent: Prisma.Decimal;
    },
    amounts: QuotationMoneyAmounts
  ): CalculatedItem {
    const { item, index, catalogItem, quantity, unitPrice, discountType, discountValue, taxPercent } = resolved;
    return {
      catalogItemId: catalogItem?.id ?? item.catalogItemId ?? null,
      type: catalogItem ? (catalogItem.type as unknown as QuotationItemType) : item.type,
      code: this.clean(catalogItem?.code ?? item.code),
      name: this.clean(catalogItem?.name ?? item.name) ?? "",
      description: this.clean(catalogItem?.description ?? item.description),
      quantity,
      unit: this.clean(catalogItem?.unit ?? item.unit) ?? "",
      unitPrice,
      discountType,
      discountValue,
      taxPercent,
      subtotal: new Prisma.Decimal(amounts.subtotal),
      discountTotal: new Prisma.Decimal(amounts.discountTotal),
      taxTotal: new Prisma.Decimal(amounts.taxTotal),
      total: new Prisma.Decimal(amounts.total),
      sortOrder: index + 1
    };
  }

  private async changeStatus(
    organizationId: string,
    quotationId: string,
    userId: string,
    nextStatus: QuotationStatus,
    note?: string
  ): Promise<QuotationWithDetails> {
    const existing = await this.findQuotation(organizationId, quotationId, this.prisma);
    this.assertTransition(existing.status, nextStatus);
    return this.prisma.$transaction(async (tx) => {
      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          status: nextStatus,
          sentAt: nextStatus === QuotationStatus.SENT ? new Date() : existing.sentAt,
          approvedAt: nextStatus === QuotationStatus.APPROVED ? new Date() : existing.approvedAt,
          rejectedAt: nextStatus === QuotationStatus.REJECTED ? new Date() : existing.rejectedAt
        }
      });
      await this.recordStatus(tx, organizationId, quotationId, existing.status, nextStatus, userId, note);
      await this.audit(tx, organizationId, userId, `quotation.${nextStatus.toLowerCase()}`, quotationId);
      return this.findQuotation(organizationId, quotationId, tx);
    });
  }

  private assertTransition(previous: QuotationStatus, next: QuotationStatus): void {
    const allowed: Record<QuotationStatus, QuotationStatus[]> = {
      DRAFT: [QuotationStatus.SENT, QuotationStatus.CANCELLED],
      SENT: [QuotationStatus.APPROVED, QuotationStatus.REJECTED, QuotationStatus.CANCELLED, QuotationStatus.DRAFT],
      CHANGES_REQUESTED: [QuotationStatus.DRAFT, QuotationStatus.CANCELLED],
      APPROVED: [],
      REJECTED: [],
      EXPIRED: [],
      CANCELLED: []
    };
    if (!allowed[previous].includes(next)) {
      throw new BadRequestException("Invalid quotation status transition");
    }
  }

  private assertDates(issueDate: string, validUntil: string): void {
    if (new Date(validUntil).getTime() < new Date(issueDate).getTime()) {
      throw new BadRequestException("validUntil must be greater than or equal to issueDate");
    }
  }

  private buildWhere(organizationId: string, query: ListQuotationsQueryDto): Prisma.QuotationWhereInput {
    return {
      organizationId,
      archivedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.issueDateFrom || query.issueDateTo
        ? { issueDate: { ...(query.issueDateFrom ? { gte: new Date(query.issueDateFrom) } : {}), ...(query.issueDateTo ? { lte: new Date(query.issueDateTo) } : {}) } }
        : {}),
      ...(query.validUntilFrom || query.validUntilTo
        ? { validUntil: { ...(query.validUntilFrom ? { gte: new Date(query.validUntilFrom) } : {}), ...(query.validUntilTo ? { lte: new Date(query.validUntilTo) } : {}) } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search.trim(), mode: "insensitive" } },
              { client: { displayName: { contains: query.search.trim(), mode: "insensitive" } } }
            ]
          }
        : {})
    };
  }

  private async ensureClientBelongsToOrganization(organizationId: string, clientId: string): Promise<void> {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, organizationId, archivedAt: null } });
    if (!client) {
      throw new BadRequestException("Client does not belong to this organization");
    }
  }

  private async findOrganization(organizationId: string, tx: Prisma.TransactionClient): Promise<Organization> {
    const organization = await tx.organization.findFirst({ where: { id: organizationId, deletedAt: null } });
    if (!organization) {
      throw new NotFoundException("Organization not found");
    }
    return organization;
  }

  private async findQuotation(
    organizationId: string,
    quotationId: string,
    tx: Prisma.TransactionClient | PrismaService,
    includeOrganization = false
  ): Promise<QuotationWithDetails> {
    const quotation = await tx.quotation.findFirst({
      where: { id: quotationId, organizationId, archivedAt: null },
      include: {
        client: true,
        organization: includeOrganization,
        createdBy: includeOrganization ? { select: { firstName: true, lastName: true } } : false,
        items: { orderBy: { sortOrder: "asc" } },
        history: { orderBy: { createdAt: "asc" } }
      }
    });
    if (!quotation) {
      throw new NotFoundException("Quotation not found");
    }
    return quotation;
  }

  private async nextNumber(organizationId: string, tx: Prisma.TransactionClient): Promise<string> {
    const latest = await tx.quotation.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" } });
    const latestNumber = latest?.number.replace("QUO-", "");
    const next = latestNumber && /^\d+$/.test(latestNumber) ? Number(latestNumber) + 1 : 1;
    return `QUO-${String(next).padStart(6, "0")}`;
  }

  private recordStatus(
    tx: Prisma.TransactionClient,
    organizationId: string,
    quotationId: string,
    previousStatus: QuotationStatus | null,
    newStatus: QuotationStatus,
    changedByUserId: string | null,
    note?: string
  ): Promise<QuotationStatusHistory> {
    return tx.quotationStatusHistory.create({
      data: { organizationId, quotationId, previousStatus, newStatus, changedByUserId, note: this.clean(note) }
    });
  }

  private audit(
    tx: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
    action: string,
    targetId: string,
    metadata?: Prisma.InputJsonValue
  ): Promise<unknown> {
    return tx.organizationAuditLog.create({
      data: { organizationId, actorUserId, action, targetType: "quotation", targetId, metadata }
    });
  }

  private sum(values: Prisma.Decimal[]): Prisma.Decimal {
    return values.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0));
  }

  private clean(value: string | null | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private changeRequestItemIndexes(value: Prisma.JsonValue, itemCount: number): number[] {
    if (!Array.isArray(value)) return [];
    return value.filter((index): index is number =>
      typeof index === "number" && Number.isInteger(index) && index >= 0 && index < itemCount
    );
  }
}
