import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { LeadStatus, LeadWhatsAppStatus } from "@prisma/client";
import { isValidInternationalPhone, normalizePhoneToE164 } from "@kaklen/shared";
import { readMarketingConfig } from "@kaklen/config";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../notifications/mail.service";
import { ERROR_CODES } from "../common/error-codes";
import { DistributedRateLimitService } from "../security/distributed-rate-limit.service";
import { CreateLeadDto, type LeadInterestType } from "./dto/lead.dto";
import { LeadWhatsAppService } from "./lead-whatsapp.service";
import {
  escapeHtml,
  normalizeOptionalText,
  normalizeProviderMessageId,
  normalizeReferrer,
  sanitizeMailHeader
} from "./lead-sanitization";

type CountryCode = Parameters<typeof normalizePhoneToE164>[1];

export interface CreateLeadResult {
  leadReference: string;
  whatsapp: { scheduled: boolean };
}

export interface LeadRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

const CONSENT_TEXT_VERSION = "privacy-2026-07-22";

const INTEREST_LABELS: Record<LeadInterestType, string> = {
  ADVISORY: "una asesoría",
  KAKLEN: "conocer Kaklen",
  PLATFORM_DEVELOPMENT: "desarrollo de plataforma",
  DIGITAL_TRANSFORMATION: "transformación digital",
  INVESTMENT_PARTNERSHIP: "inversión o alianza",
  KAPIAR: "Kapiar",
  OTHER: "tu consulta"
};

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);
  private readonly config = readMarketingConfig(process.env);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly whatsapp: LeadWhatsAppService,
    private readonly rateLimits: DistributedRateLimitService
  ) {}

  async create(dto: CreateLeadDto, context: LeadRequestContext): Promise<CreateLeadResult> {
    if (!dto.privacyConsent) {
      throw new BadRequestException({
        code: ERROR_CODES.privacyConsentRequired,
        message: "Privacy policy consent is required"
      });
    }

    const countryCode = dto.phoneCountryCode.toUpperCase() as CountryCode;
    if (!isValidInternationalPhone(dto.phone, countryCode)) {
      throw new BadRequestException({
        code: ERROR_CODES.leadPhoneInvalid,
        message: "Phone number is invalid"
      });
    }
    const phoneE164 = normalizePhoneToE164(dto.phone, countryCode);
    const consentIpHash = this.hashOptional(context.ipAddress);
    const userAgentHash = this.hashOptional(context.userAgent);

    const now = new Date();
    const lead = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email: dto.email.trim().toLowerCase(),
          phoneCountryCode: countryCode,
          phoneE164,
          company: dto.company?.trim() || null,
          position: dto.position?.trim() || null,
          country: dto.country?.trim() || null,
          interestType: dto.interestType,
          message: dto.message.trim(),
          privacyConsent: true,
          whatsappConsent: dto.whatsappConsent,
          consentTextVersion: CONSENT_TEXT_VERSION,
          consentRecordedAt: now,
          consentIpHash,
          userAgentHash,
          utmSource: normalizeOptionalText(dto.utmSource),
          utmMedium: normalizeOptionalText(dto.utmMedium),
          utmCampaign: normalizeOptionalText(dto.utmCampaign),
          utmContent: normalizeOptionalText(dto.utmContent),
          landingPage: normalizeOptionalText(dto.landingPage),
          referrer: normalizeReferrer(dto.referrer),
          status: LeadStatus.NEW
        }
      });
      await tx.leadEvent.create({
        data: { leadId: created.id, eventType: "lead.created" }
      });
      return created;
    });

    await this.notifyTeam(lead.id, lead.firstName, lead.lastName, lead.email, lead.interestType, lead.message);

    let whatsappScheduled = false;
    if (dto.whatsappConsent) {
      whatsappScheduled = await this.sendWelcomeWhatsApp(lead.id, lead.firstName, phoneE164, dto.interestType);
    }

    return { leadReference: lead.id, whatsapp: { scheduled: whatsappScheduled } };
  }

  private async notifyTeam(
    leadId: string,
    firstName: string,
    lastName: string,
    email: string,
    interestType: string,
    message: string
  ): Promise<void> {
    try {
      const safeFirstName = sanitizeMailHeader(firstName);
      const safeLastName = sanitizeMailHeader(lastName);
      const safeEmail = sanitizeMailHeader(email);
      const safeInterestType = sanitizeMailHeader(interestType);
      await this.mail.send({
        mailType: "lead_notification",
        locale: "es",
        to: this.config.leadNotificationEmail,
        subject: `Nuevo lead: ${safeFirstName} ${safeLastName}`,
        text: `Nuevo lead desde el sitio de Kaklen.\n\nNombre: ${safeFirstName} ${safeLastName}\nCorreo: ${safeEmail}\nInterés: ${safeInterestType}\n\nMensaje:\n${message}\n\nRevisa el detalle en la base de datos (lead ${leadId}).`,
        html: `<p>Nuevo lead desde el sitio de Kaklen.</p><ul><li><strong>Nombre:</strong> ${escapeHtml(safeFirstName)} ${escapeHtml(safeLastName)}</li><li><strong>Correo:</strong> ${escapeHtml(safeEmail)}</li><li><strong>Interés:</strong> ${escapeHtml(safeInterestType)}</li></ul><p><strong>Mensaje:</strong><br/>${escapeHtml(message)}</p><p>Lead: ${escapeHtml(leadId)}</p>`
      });
      await this.recordEventSafely(leadId, "notification.email.sent");
    } catch (error) {
      this.logger.error(`Failed to send internal lead notification for lead ${leadId}`);
      await this.recordEventSafely(leadId, "notification.email.failed");
    }
  }

  private async sendWelcomeWhatsApp(
    leadId: string,
    firstName: string,
    phoneE164: string,
    interestType: LeadInterestType
  ): Promise<boolean> {
    try {
      const result = await this.whatsapp.sendWelcome({
        firstName,
        phoneE164,
        interestLabel: INTEREST_LABELS[interestType]
      });

      await this.prisma.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: leadId },
          data: {
            whatsappStatus: result.status as LeadWhatsAppStatus,
            whatsappSentAt: result.status === "SENT" ? new Date() : null,
            whatsappError: result.error ?? null
          }
        });
        const providerMessageId = result.providerMessageId
          ? normalizeProviderMessageId(result.providerMessageId)
          : undefined;
        await tx.leadEvent.create({
          data: {
            leadId,
            eventType: `whatsapp.${result.mode}.${result.status.toLowerCase()}`,
            ...(providerMessageId ? { metadata: { providerMessageId } } : {})
          }
        });
      });

      return result.status === "SENT";
    } catch {
      this.logger.error(`Failed to process WhatsApp welcome for lead ${leadId}`);
      await this.recordEventSafely(leadId, "whatsapp.processing.failed");
      return false;
    }
  }

  private hashOptional(value: string | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? this.rateLimits.hashSensitive(normalized) : null;
  }

  private async recordEventSafely(leadId: string, eventType: string): Promise<void> {
    try {
      await this.prisma.leadEvent.create({ data: { leadId, eventType } });
    } catch {
      this.logger.error(`Failed to record ${eventType} for lead ${leadId}`);
    }
  }
}
