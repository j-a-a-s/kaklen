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
import { calculateQuotationMoney, QuotationDecimalInput, QuotationMoneyAmounts } from "@kaklen/shared";
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
import { createSimplePdf } from "./pdf";

type QuotationWithDetails = Quotation & {
  client: Client;
  items: QuotationItem[];
  history?: QuotationStatusHistory[];
  organization?: Organization;
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
  approved: number;
  rejected: number;
  expired: number;
  cancelled: number;
  amountApproved: string;
}

export interface QuotationPdfDocument {
  buffer: Buffer;
  filename: string;
}

export type QuotationHistoryView = QuotationStatusHistory & {
  changedBy: Pick<Prisma.UserGetPayload<object>, "firstName" | "lastName">;
};

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly mailService?: MailService
  ) {}

  async create(organizationId: string, userId: string, dto: CreateQuotationDto): Promise<QuotationWithDetails> {
    this.assertDates(dto.issueDate, dto.validUntil);
    await this.ensureClientBelongsToOrganization(organizationId, dto.clientId);

    return this.prisma.$transaction(async (tx) => {
      const organization = await this.findOrganization(organizationId, tx);
      const totals = await this.calculateItems(organizationId, dto.items, dto.globalDiscountPercent ?? 0, tx);
      const number = await this.nextNumber(organizationId, tx);
      const quotation = await tx.quotation.create({
        data: {
          organizationId,
          clientId: dto.clientId,
          number,
          issueDate: new Date(dto.issueDate),
          validUntil: new Date(dto.validUntil),
          currency: this.clean(dto.currency)?.toUpperCase() ?? organization.currency,
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
    const [grouped, approved] = await this.prisma.$transaction([
      this.prisma.quotation.groupBy({
        by: ["status"],
        where: { organizationId, archivedAt: null },
        _count: { _all: true },
        orderBy: { status: "asc" }
      }),
      this.prisma.quotation.aggregate({
        where: { organizationId, archivedAt: null, status: QuotationStatus.APPROVED },
        _sum: { total: true }
      })
    ]);
    const count = (status: QuotationStatus): number => {
      const item = grouped.find((group) => group.status === status);
      return typeof item?._count === "object" ? item._count._all ?? 0 : 0;
    };
    return {
      total: grouped.reduce((sum, item) => sum + (typeof item._count === "object" ? item._count._all ?? 0 : 0), 0),
      draft: count(QuotationStatus.DRAFT),
      sent: count(QuotationStatus.SENT),
      approved: count(QuotationStatus.APPROVED),
      rejected: count(QuotationStatus.REJECTED),
      expired: count(QuotationStatus.EXPIRED),
      cancelled: count(QuotationStatus.CANCELLED),
      amountApproved: (approved._sum.total ?? new Prisma.Decimal(0)).toFixed(2)
    };
  }

  async get(organizationId: string, quotationId: string): Promise<QuotationWithDetails> {
    return this.findQuotation(organizationId, quotationId, this.prisma);
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
      const shouldRecalculate = dto.items !== undefined || dto.globalDiscountPercent !== undefined;
      const calculationItems = dto.items ?? existing.items.map((item) => ({
        catalogItemId: item.catalogItemId ?? undefined,
        type: item.type,
        code: item.code ?? undefined,
        name: item.name,
        description: item.description ?? undefined,
        quantity: item.quantity.toNumber(),
        unit: item.unit,
        unitPrice: item.unitPrice.toNumber(),
        discountType: item.discountType,
        discountValue: item.discountValue.toNumber(),
        taxPercent: item.taxPercent.toNumber()
      }));
      const globalDiscountPercent = dto.globalDiscountPercent ?? existing.globalDiscountPercent.toNumber();
      const totals = shouldRecalculate ? await this.calculateItems(organizationId, calculationItems, globalDiscountPercent, tx) : null;
      if (totals) {
        await tx.quotationItem.deleteMany({ where: { quotationId } });
      }
      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          clientId: dto.clientId,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          currency: dto.currency?.trim().toUpperCase(),
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
    if (quotation.status !== QuotationStatus.DRAFT && quotation.status !== QuotationStatus.SENT) {
      throw new BadRequestException("Quotation cannot be emailed from its current status");
    }
    if (!this.mailService) {
      throw new ServiceUnavailableException("Mail service is not available");
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
    const labels = pdfLabels(language);
    const buffer = createSimplePdf([
      { text: quotation.organization?.name ?? "Kaklen", size: 16 },
      { text: `${labels.quotation}: ${quotation.number} v${quotation.version}`, size: 14 },
      { text: `${labels.client}: ${quotation.client.displayName}` },
      { text: `${labels.issueDate}: ${quotation.issueDate.toISOString().slice(0, 10)}` },
      { text: `${labels.validUntil}: ${quotation.validUntil.toISOString().slice(0, 10)}` },
      { text: `${labels.items}:` },
      ...quotation.items.map((item) => ({ text: `- ${item.name} ${item.quantity.toString()} x ${item.unitPrice.toFixed(2)} = ${item.total.toFixed(2)}` })),
      { text: `${labels.subtotal}: ${quotation.currency} ${quotation.subtotal.toFixed(2)}` },
      { text: `${labels.discount}: ${quotation.currency} ${quotation.discountTotal.toFixed(2)}` },
      { text: `${labels.tax}: ${quotation.currency} ${quotation.taxTotal.toFixed(2)}` },
      { text: `${labels.total}: ${quotation.currency} ${quotation.total.toFixed(2)}`, size: 14 },
      ...(quotation.notes ? [{ text: `${labels.notes}: ${quotation.notes}` }] : []),
      ...(quotation.terms ? [{ text: `${labels.terms}: ${quotation.terms}` }] : [])
    ]);
    const prefix = language === "en" ? "quotation" : language === "pt-BR" ? "cotacao" : "cotizacion";
    const safeNumber = quotation.number.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    return { buffer, filename: `${prefix}-${safeNumber}-v${quotation.version}.pdf` };
  }

  calculateQuotationItems(
    items: QuotationItemInputDto[],
    catalogItems = new Map<string, CatalogItem>(),
    globalDiscountPercent: QuotationDecimalInput = 0
  ): CalculatedTotals {
    const calculatedItems = items.map((item, index) => this.calculateItem(item, index, catalogItems.get(item.catalogItemId ?? ""), globalDiscountPercent));
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
    items: QuotationItemInputDto[],
    globalDiscountPercent: QuotationDecimalInput,
    tx: Prisma.TransactionClient
  ): Promise<CalculatedTotals> {
    const catalogIds = items.map((item) => item.catalogItemId).filter((item): item is string => Boolean(item));
    const catalogItems = catalogIds.length
      ? await tx.catalogItem.findMany({ where: { organizationId, id: { in: catalogIds } } })
      : [];
    if (catalogItems.length !== new Set(catalogIds).size) {
      throw new BadRequestException("Catalog item does not belong to this organization");
    }
    return this.calculateQuotationItems(items, new Map(catalogItems.map((item) => [item.id, item])), globalDiscountPercent);
  }

  private calculateItem(
    item: QuotationItemInputDto,
    index: number,
    catalogItem: CatalogItem | undefined,
    globalDiscountPercent: QuotationDecimalInput
  ): CalculatedItem {
    const quantity = new Prisma.Decimal(item.quantity);
    const unitPrice = new Prisma.Decimal(catalogItem?.price ?? item.unitPrice);
    const discountType = item.discountType ?? QuotationDiscountType.NONE;
    const discountValue = new Prisma.Decimal(item.discountValue ?? 0);
    const taxPercent = new Prisma.Decimal(catalogItem?.taxPercent ?? item.taxPercent);
    let amounts: QuotationMoneyAmounts;
    try {
      amounts = calculateQuotationMoney([{
        quantity: quantity.toString(),
        unitPrice: unitPrice.toString(),
        discountType,
        discountValue: discountValue.toString(),
        taxPercent: taxPercent.toString()
      }], globalDiscountPercent).lines[0];
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid quotation amounts");
    }
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
    changedByUserId: string,
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
    return this.money(values.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0)));
  }

  private money(value: Prisma.Decimal): Prisma.Decimal {
    return new Prisma.Decimal(value.toFixed(2));
  }

  private clean(value: string | null | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }
}

function pdfLabels(locale: string): Record<string, string> {
  if (locale === "en") {
    return {
      quotation: "Quotation",
      client: "Client",
      issueDate: "Issue date",
      validUntil: "Valid until",
      items: "Items",
      subtotal: "Subtotal",
      discount: "Discount",
      tax: "Tax",
      total: "Total",
      notes: "Notes",
      terms: "Terms"
    };
  }
  if (locale === "pt-BR") {
    return {
      quotation: "Cotação",
      client: "Cliente",
      issueDate: "Data de emissão",
      validUntil: "Válida até",
      items: "Itens",
      subtotal: "Subtotal",
      discount: "Desconto",
      tax: "Imposto",
      total: "Total",
      notes: "Notas",
      terms: "Termos"
    };
  }
  return {
    quotation: "Cotización",
    client: "Cliente",
    issueDate: "Fecha de emisión",
    validUntil: "Válida hasta",
    items: "Ítems",
    subtotal: "Subtotal",
    discount: "Descuento",
    tax: "Impuesto",
    total: "Total",
    notes: "Notas",
    terms: "Términos"
  };
}
