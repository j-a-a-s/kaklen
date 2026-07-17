import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  ProviderAnalyticsEventType,
  ProviderProfile,
  ProviderProfileStatus,
  QuotationStatus
} from "@prisma/client";
import { isValidCountryPhone, normalizeInternationalPhone } from "@kaklen/shared";
import { PrismaService } from "../prisma/prisma.service";
import { assertMoneyPrecision } from "../common/money-validation";
import { QuotationPortalService } from "../quotation-portal/quotation-portal.service";
import { CreateProviderProfileDto, ReviewProviderProfileDto } from "./dto/provider-profile.dto";

@Injectable()
export class ProviderProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly portal: QuotationPortalService
  ) {}

  async recommendationShown(publicToken: string): Promise<{ recorded: true }> {
    const resolved = await this.portal.resolve(publicToken, true);
    this.assertEligible(resolved.quotation.status, resolved.quotation.paidAt);
    await this.prisma.providerAnalyticsEvent.create({
      data: {
        organizationId: resolved.quotation.organizationId,
        event: ProviderAnalyticsEventType.RECOMMENDATION_SHOWN
      }
    });
    return { recorded: true };
  }

  async create(publicToken: string, dto: CreateProviderProfileDto): Promise<ProviderProfile> {
    const resolved = await this.portal.resolve(publicToken, true);
    const quotation = resolved.quotation;
    this.assertEligible(quotation.status, quotation.paidAt);
    const whatsapp = normalizeInternationalPhone(dto.whatsapp);
    if (!isValidCountryPhone(whatsapp, dto.country)) {
      throw new BadRequestException({
        code: "PROVIDER_WHATSAPP_INVALID",
        message: "WhatsApp number is invalid for the selected country"
      });
    }
    const currency = dto.currency.toUpperCase();
    if (dto.price !== undefined) assertMoneyPrecision(dto.price, currency);

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.providerProfile.upsert({
        where: {
          organizationId_sourceClientId: {
            organizationId: quotation.organizationId,
            sourceClientId: quotation.clientId
          }
        },
        create: {
          organizationId: quotation.organizationId,
          sourceClientId: quotation.clientId,
          category: dto.category.trim(),
          description: dto.description.trim(),
          country: dto.country,
          region: clean(dto.region),
          city: clean(dto.city),
          whatsapp,
          price: dto.price === undefined ? null : new Prisma.Decimal(dto.price),
          currency,
          portfolioUrl: clean(dto.portfolioUrl),
          status: ProviderProfileStatus.IN_REVIEW,
          consentAt: new Date()
        },
        update: {
          category: dto.category.trim(),
          description: dto.description.trim(),
          country: dto.country,
          region: clean(dto.region),
          city: clean(dto.city),
          whatsapp,
          price: dto.price === undefined ? null : new Prisma.Decimal(dto.price),
          currency,
          portfolioUrl: clean(dto.portfolioUrl),
          status: ProviderProfileStatus.IN_REVIEW,
          consentAt: new Date(),
          reviewedAt: null,
          publishedAt: null
        }
      });
      await tx.providerAnalyticsEvent.createMany({
        data: [
          {
            organizationId: quotation.organizationId,
            profileId: profile.id,
            event: ProviderAnalyticsEventType.PROVIDER_SIGNUP_STARTED
          },
          {
            organizationId: quotation.organizationId,
            profileId: profile.id,
            event: ProviderAnalyticsEventType.PROVIDER_PROFILE_COMPLETED
          }
        ]
      });
      return profile;
    });
  }

  list(organizationId: string): Promise<ProviderProfile[]> {
    return this.prisma.providerProfile.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" }
    });
  }

  async review(
    organizationId: string,
    profileId: string,
    dto: ReviewProviderProfileDto
  ): Promise<ProviderProfile> {
    const profile = await this.prisma.providerProfile.findFirst({
      where: { id: profileId, organizationId }
    });
    if (!profile) {
      throw new NotFoundException({ code: "PROVIDER_PROFILE_NOT_FOUND", message: "Provider profile not found" });
    }
    const status = ProviderProfileStatus[dto.status];
    return this.prisma.providerProfile.update({
      where: { id: profile.id },
      data: {
        status,
        reviewedAt: new Date(),
        publishedAt: status === ProviderProfileStatus.PUBLISHED ? new Date() : null
      }
    });
  }

  private assertEligible(status: QuotationStatus, paidAt: Date | null): void {
    if (status !== QuotationStatus.APPROVED && !paidAt) {
      throw new BadRequestException({
        code: "PROVIDER_RECOMMENDATION_NOT_AVAILABLE",
        message: "Provider recommendation is available only after approval or payment"
      });
    }
  }
}

function clean(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
