import { Injectable, NotFoundException } from "@nestjs/common";
import { CatalogItemStatus, ClientStatus, EventStatus, OrganizationStatus, QuotationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ACTIVATION_STEPS, ActivationStep, UserActivation } from "./assistant.types";

@Injectable()
export class UserActivationService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(organizationId: string): Promise<UserActivation> {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, status: { not: OrganizationStatus.DELETED }, deletedAt: null },
      select: { legalName: true, taxId: true, country: true }
    });
    if (!organization) throw new NotFoundException("Organization not found");

    const [clients, catalogItems, quotations, sentQuotations, approvedQuotations, events] = await Promise.all([
      this.prisma.client.count({ where: { organizationId, status: { not: ClientStatus.ARCHIVED } } }),
      this.prisma.catalogItem.count({ where: { organizationId, status: { not: CatalogItemStatus.ARCHIVED } } }),
      this.prisma.quotation.count({ where: { organizationId, archivedAt: null } }),
      this.prisma.quotation.count({ where: { organizationId, sentAt: { not: null }, archivedAt: null } }),
      this.prisma.quotation.count({ where: { organizationId, status: QuotationStatus.APPROVED, archivedAt: null } }),
      this.prisma.event.count({ where: { organizationId, status: { not: EventStatus.ARCHIVED }, archivedAt: null } })
    ]);

    const completion: Record<ActivationStep, boolean> = {
      organization_configured: Boolean(organization.legalName && (organization.country !== "CL" || organization.taxId)),
      first_client_created: clients > 0,
      first_catalog_item_created: catalogItems > 0,
      first_quotation_created: quotations > 0,
      first_quotation_sent: sentQuotations > 0,
      first_quotation_approved: approvedQuotations > 0,
      first_event_created: events > 0
    };
    const completedSteps = ACTIVATION_STEPS.filter((step) => completion[step]);
    const currentStep = ACTIVATION_STEPS.find((step) => !completion[step]) ?? null;
    const isCompleted = currentStep === null;

    return {
      completedSteps,
      totalSteps: ACTIVATION_STEPS.length,
      percentage: Math.round((completedSteps.length / ACTIVATION_STEPS.length) * 100),
      currentStep,
      nextRecommendedAction: currentStep ?? "create_opportunity",
      isCompleted
    };
  }
}
