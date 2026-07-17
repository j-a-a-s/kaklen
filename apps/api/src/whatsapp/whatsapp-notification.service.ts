import {
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException
} from "@nestjs/common";
import { createHmac } from "node:crypto";
import { WhatsAppNotificationStatus } from "@prisma/client";
import {
  readPasswordRecoveryConfig,
  readProductIntegrationsConfig
} from "@kaklen/config";
import { PrismaService } from "../prisma/prisma.service";
import { hashPublicToken } from "../quotation-portal/public-token";
import { PrepareWhatsAppNotificationDto } from "./dto/whatsapp.dto";
import { WHATSAPP_PROVIDER, WhatsAppProvider } from "./whatsapp-provider";

export interface PreparedWhatsAppNotification {
  id: string;
  mode: "manual" | "provider";
  status: WhatsAppNotificationStatus;
  message: string;
  publicUrl: string;
  waUrl?: string;
}

@Injectable()
export class WhatsAppNotificationService {
  private readonly config = readProductIntegrationsConfig(process.env);
  private readonly appPublicUrl = readPasswordRecoveryConfig(process.env).appPublicUrl;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(WHATSAPP_PROVIDER) private readonly provider?: WhatsAppProvider
  ) {}

  async prepare(
    organizationId: string,
    quotationId: string,
    userId: string,
    dto: PrepareWhatsAppNotificationDto
  ): Promise<PreparedWhatsAppNotification> {
    const link = await this.prisma.quotationPublicLink.findFirst({
      where: {
        organizationId,
        quotationId,
        tokenHash: hashPublicToken(dto.publicToken),
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: { quotation: { include: { client: true } } }
    });
    const recipient = normalizeWhatsApp(link?.quotation.client.whatsapp ?? "");
    if (!link || !recipient) {
      throw new NotFoundException({
        code: "WHATSAPP_RECIPIENT_OR_LINK_UNAVAILABLE",
        message: "Quotation link or WhatsApp recipient is unavailable"
      });
    }

    const locale = dto.locale ?? "es";
    const publicUrl = `${this.appPublicUrl}/${locale}/p/quotations/${dto.publicToken}`;
    const message = notificationMessage(locale, publicUrl);
    const baseData = {
      organizationId,
      quotationId,
      publicLinkId: link.id,
      createdByUserId: userId,
      recipientHash: this.hashRecipient(recipient)
    };

    if (this.config.whatsappMode === "provider") {
      if (!this.provider) {
        throw new ServiceUnavailableException({
          code: "WHATSAPP_PROVIDER_NOT_CONFIGURED",
          message: "WhatsApp provider mode requires provider credentials and an adapter"
        });
      }
      const pending = await this.prisma.whatsAppNotification.create({
        data: { ...baseData, status: WhatsAppNotificationStatus.PENDING }
      });
      try {
        const sent = await this.provider.send({ recipient: `+${recipient}`, message });
        const updated = await this.prisma.whatsAppNotification.update({
          where: { id: pending.id },
          data: {
            status: WhatsAppNotificationStatus.SENT,
            providerMessageId: sent.providerMessageId,
            sentAt: new Date()
          }
        });
        return { id: updated.id, mode: "provider", status: updated.status, message, publicUrl };
      } catch (error) {
        await this.prisma.whatsAppNotification.update({
          where: { id: pending.id },
          data: { status: WhatsAppNotificationStatus.FAILED, failedAt: new Date() }
        });
        throw new ServiceUnavailableException({
          code: "WHATSAPP_PROVIDER_FAILED",
          message: error instanceof Error ? error.message : "WhatsApp provider failed"
        });
      }
    }

    const prepared = await this.prisma.whatsAppNotification.create({
      data: {
        ...baseData,
        status: WhatsAppNotificationStatus.PREPARED,
        preparedAt: new Date()
      }
    });
    return {
      id: prepared.id,
      mode: "manual",
      status: prepared.status,
      message,
      publicUrl,
      waUrl: `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`
    };
  }

  private hashRecipient(recipient: string): string {
    return createHmac("sha256", this.config.whatsappHashSecret)
      .update(recipient, "utf8")
      .digest("hex");
  }
}

function normalizeWhatsApp(value: string): string {
  const normalized = value.replace(/\D/g, "");
  return normalized.length >= 8 && normalized.length <= 15 ? normalized : "";
}

function notificationMessage(locale: "es" | "en" | "pt-BR", publicUrl: string): string {
  if (locale === "en") {
    return `Hello. You have a new Kaklen notification.\nReview your quotation and respond securely here:\n${publicUrl}`;
  }
  if (locale === "pt-BR") {
    return `Olá. Você tem uma nova notificação da Kaklen.\nRevise sua cotação e responda com segurança aqui:\n${publicUrl}`;
  }
  return `Hola. Tienes una nueva notificación de Kaklen.\nRevisa tu cotización y responde de forma segura aquí:\n${publicUrl}`;
}
