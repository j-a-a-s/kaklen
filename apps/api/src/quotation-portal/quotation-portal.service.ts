import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  InAppNotificationType,
  Prisma,
  QuotationPublicLink,
  QuotationStatus
} from "@prisma/client";
import { readPasswordRecoveryConfig } from "@kaklen/config";
import { PrismaService } from "../prisma/prisma.service";
import { serializeMoney } from "../common/money-validation";
import { InAppNotificationsService } from "../in-app-notifications/in-app-notifications.service";
import {
  CreateQuotationPublicLinkDto,
  RequestQuotationChangesDto
} from "./dto/quotation-portal.dto";
import { createPublicToken, hashPublicToken } from "./public-token";

const publicQuotationInclude = {
  organization: true,
  client: true,
  items: { orderBy: { sortOrder: "asc" as const } },
  history: { orderBy: { createdAt: "asc" as const } }
} satisfies Prisma.QuotationInclude;

type PublicQuotation = Prisma.QuotationGetPayload<{ include: typeof publicQuotationInclude }>;

interface ResolvedPublicQuotation {
  link: QuotationPublicLink;
  quotation: PublicQuotation;
  latestVersion: number;
  isLatestVersion: boolean;
}

@Injectable()
export class QuotationPortalService {
  private readonly appPublicUrl = readPasswordRecoveryConfig(process.env).appPublicUrl;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: InAppNotificationsService
  ) {}

  async createLink(
    organizationId: string,
    quotationId: string,
    userId: string,
    dto: CreateQuotationPublicLinkDto
  ) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, organizationId, archivedAt: null }
    });
    if (!quotation) {
      throw new NotFoundException({ code: "QUOTATION_NOT_FOUND", message: "Quotation not found" });
    }
    const token = createPublicToken();
    const expiresAt = new Date(Date.now() + (dto.expiresInHours ?? 168) * 60 * 60 * 1000);
    const link = await this.prisma.$transaction(async (tx) => {
      if (quotation.status === QuotationStatus.DRAFT) {
        await tx.quotation.update({
          where: { id: quotation.id },
          data: { status: QuotationStatus.SENT, sentAt: new Date() }
        });
        await tx.quotationStatusHistory.create({
          data: {
            organizationId,
            quotationId,
            previousStatus: QuotationStatus.DRAFT,
            newStatus: QuotationStatus.SENT,
            changedByUserId: userId,
            note: "quotation.portal.shared"
          }
        });
        await tx.organizationAuditLog.create({
          data: {
            organizationId,
            actorUserId: userId,
            action: "quotation.portal.shared",
            targetType: "quotation",
            targetId: quotationId
          }
        });
      }
      await tx.quotationPublicLink.updateMany({
        where: { quotationId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      return tx.quotationPublicLink.create({
        data: {
          organizationId,
          quotationId,
          tokenHash: hashPublicToken(token),
          expiresAt,
          createdByUserId: userId
        }
      });
    });
    const locale = dto.locale ?? "es";
    const path = `/p/quotations/${token}`;
    return {
      id: link.id,
      expiresAt: link.expiresAt,
      publicToken: token,
      path,
      url: `${this.appPublicUrl}/${locale}${path}`
    };
  }

  async revokeLink(
    organizationId: string,
    quotationId: string
  ): Promise<{ revoked: number }> {
    const result = await this.prisma.quotationPublicLink.updateMany({
      where: { organizationId, quotationId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return { revoked: result.count };
  }

  async view(token: string) {
    const resolved = await this.resolve(token);
    if (!resolved.link.lastViewedAt) {
      const update = await this.prisma.quotationPublicLink.updateMany({
        where: { id: resolved.link.id, lastViewedAt: null },
        data: { lastViewedAt: new Date() }
      });
      if (update.count === 1) {
        await this.notify(resolved.quotation, InAppNotificationType.QUOTATION_VIEWED);
      }
    }
    return this.toPublicView(resolved);
  }

  async requestChanges(token: string, dto: RequestQuotationChangesDto) {
    const resolved = await this.resolve(token, true);
    this.assertActionable(resolved, QuotationStatus.SENT);
    const comment = dto.comment.trim();
    const itemIndexes = [...new Set(dto.itemIndexes ?? [])].sort((left, right) => left - right);
    if (itemIndexes.some((index) => index >= resolved.quotation.items.length)) {
      throw new BadRequestException({
        code: "QUOTATION_ITEM_REFERENCE_INVALID",
        message: "Referenced quotation item does not exist"
      });
    }
    const changeRequest = await this.prisma.$transaction(async (tx) => {
      const created = await tx.quotationChangeRequest.create({
        data: {
          organizationId: resolved.quotation.organizationId,
          quotationId: resolved.quotation.id,
          publicLinkId: resolved.link.id,
          comment,
          itemIndexes
        }
      });
      await tx.quotation.update({
        where: { id: resolved.quotation.id },
        data: { status: QuotationStatus.CHANGES_REQUESTED }
      });
      await tx.quotationStatusHistory.create({
        data: {
          organizationId: resolved.quotation.organizationId,
          quotationId: resolved.quotation.id,
          previousStatus: resolved.quotation.status,
          newStatus: QuotationStatus.CHANGES_REQUESTED,
          changedByUserId: null,
          note: "quotation.changes_requested"
        }
      });
      return created;
    });
    await this.notify(
      resolved.quotation,
      InAppNotificationType.QUOTATION_CHANGES_REQUESTED
    );
    return { id: changeRequest.id, status: QuotationStatus.CHANGES_REQUESTED };
  }

  async approve(token: string) {
    const resolved = await this.resolve(token, true);
    this.assertActionable(resolved, QuotationStatus.SENT);
    await this.prisma.$transaction(async (tx) => {
      await tx.quotation.update({
        where: { id: resolved.quotation.id },
        data: { status: QuotationStatus.APPROVED, approvedAt: new Date() }
      });
      await tx.quotationStatusHistory.create({
        data: {
          organizationId: resolved.quotation.organizationId,
          quotationId: resolved.quotation.id,
          previousStatus: resolved.quotation.status,
          newStatus: QuotationStatus.APPROVED,
          changedByUserId: null,
          note: "quotation.portal.approved"
        }
      });
    });
    await this.notify(resolved.quotation, InAppNotificationType.QUOTATION_APPROVED);
    return { status: QuotationStatus.APPROVED };
  }

  async resolve(token: string, requireCurrent = false): Promise<ResolvedPublicQuotation> {
    if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) {
      throw this.unavailable();
    }
    const link = await this.prisma.quotationPublicLink.findUnique({
      where: { tokenHash: hashPublicToken(token) },
      include: { quotation: { include: publicQuotationInclude } }
    });
    if (!link || link.revokedAt || link.expiresAt.getTime() <= Date.now()) {
      throw this.unavailable();
    }
    const latest = await this.prisma.quotation.findFirst({
      where: {
        organizationId: link.organizationId,
        number: link.quotation.number,
        archivedAt: null
      },
      orderBy: { version: "desc" },
      select: { id: true, version: true }
    });
    const resolved = {
      link,
      quotation: link.quotation,
      latestVersion: latest?.version ?? link.quotation.version,
      isLatestVersion: latest?.id === link.quotation.id
    };
    if (requireCurrent && !resolved.isLatestVersion) {
      throw new GoneException({
        code: "QUOTATION_VERSION_OBSOLETE",
        message: "A newer quotation version is available"
      });
    }
    return resolved;
  }

  private assertActionable(
    resolved: ResolvedPublicQuotation,
    expectedStatus: QuotationStatus
  ): void {
    if (!resolved.isLatestVersion) {
      throw new GoneException({ code: "QUOTATION_VERSION_OBSOLETE", message: "Quotation version is obsolete" });
    }
    if (resolved.quotation.status !== expectedStatus) {
      throw new BadRequestException({
        code: "QUOTATION_PORTAL_ACTION_NOT_ALLOWED",
        message: "Quotation does not allow this action"
      });
    }
  }

  private toPublicView(resolved: ResolvedPublicQuotation) {
    const { quotation, link } = resolved;
    return {
      organization: {
        name: quotation.organization.name,
        legalName: quotation.organization.legalName,
        taxId: quotation.organization.taxId,
        address: quotation.organization.address,
        phone: quotation.organization.phone,
        whatsapp: quotation.organization.whatsapp,
        country: quotation.organization.country
      },
      client: {
        displayName: quotation.client.displayName,
        legalName: quotation.client.legalName,
        taxId: quotation.client.taxId,
        email: quotation.client.email,
        whatsapp: quotation.client.whatsapp,
        address: quotation.client.address
      },
      quotation: {
        number: quotation.number,
        version: quotation.version,
        latestVersion: resolved.latestVersion,
        isLatestVersion: resolved.isLatestVersion,
        status: quotation.status,
        issueDate: quotation.issueDate,
        validUntil: quotation.validUntil,
        currency: quotation.currency,
        subtotal: serializeMoney(quotation.subtotal.toString(), quotation.currency),
        discountTotal: serializeMoney(quotation.discountTotal.toString(), quotation.currency),
        taxTotal: serializeMoney(quotation.taxTotal.toString(), quotation.currency),
        total: serializeMoney(quotation.total.toString(), quotation.currency),
        notes: quotation.notes,
        terms: quotation.terms,
        items: quotation.items.map((item, index) => ({
          index,
          code: item.code,
          name: item.name,
          description: item.description,
          quantity: item.quantity.toString(),
          unit: item.unit,
          unitPrice: serializeMoney(item.unitPrice.toString(), quotation.currency),
          discountType: item.discountType,
          discountValue: item.discountType === "PERCENTAGE"
            ? item.discountValue.toString()
            : serializeMoney(item.discountValue.toString(), quotation.currency),
          taxPercent: item.taxPercent.toString(),
          total: serializeMoney(item.total.toString(), quotation.currency)
        })),
        history: quotation.history.map((history) => ({
          eventCode: history.note ?? `quotation.${history.newStatus.toLowerCase()}`,
          status: history.newStatus,
          createdAt: history.createdAt
        }))
      },
      link: { expiresAt: link.expiresAt },
      actions: {
        canRequestChanges: resolved.isLatestVersion && quotation.status === QuotationStatus.SENT,
        canApproveAndPay: resolved.isLatestVersion && quotation.status === QuotationStatus.SENT,
        canOfferServices:
          quotation.status === QuotationStatus.APPROVED || Boolean(quotation.paidAt)
      }
    };
  }

  private async notify(
    quotation: PublicQuotation,
    type: InAppNotificationType
  ): Promise<void> {
    const content = notificationContent(type, quotation.number, quotation.client.displayName);
    await this.notifications.notifyOrganization(quotation.organizationId, {
      type,
      ...content,
      resourceType: "quotation",
      resourceId: quotation.id,
      route: `/organizations/${quotation.organizationId}/quotations/${quotation.id}`
    });
  }

  private unavailable(): NotFoundException {
    return new NotFoundException({
      code: "QUOTATION_LINK_UNAVAILABLE",
      message: "Quotation link is invalid, expired or revoked"
    });
  }
}

function notificationContent(
  type: InAppNotificationType,
  number: string,
  client: string
): { title: string; body: string } {
  const values: Partial<Record<InAppNotificationType, { title: string; body: string }>> = {
    QUOTATION_VIEWED: { title: "Quotation viewed", body: `${client} viewed ${number}.` },
    QUOTATION_CHANGES_REQUESTED: { title: "Changes requested", body: `${client} requested changes to ${number}.` },
    QUOTATION_APPROVED: { title: "Quotation approved", body: `${client} approved ${number}.` }
  };
  return values[type] ?? { title: "Quotation updated", body: `${number} was updated.` };
}
