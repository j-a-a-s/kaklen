import { Inject, Injectable, Optional } from "@nestjs/common";
import { readProductIntegrationsConfig } from "@kaklen/config";
import { WHATSAPP_PROVIDER, type WhatsAppProvider } from "../whatsapp/whatsapp-provider";
import { normalizeProviderMessageId, providerFailureCode } from "./lead-sanitization";

export interface LeadWhatsAppInput {
  firstName: string;
  phoneE164: string;
  interestLabel: string;
}

export interface LeadWhatsAppResult {
  status: "SENT" | "PENDING" | "FAILED";
  mode: "manual" | "provider";
  providerMessageId?: string;
  error?: string;
}

@Injectable()
export class LeadWhatsAppService {
  private readonly config = readProductIntegrationsConfig(process.env);

  constructor(@Optional() @Inject(WHATSAPP_PROVIDER) private readonly provider?: WhatsAppProvider) {}

  async sendWelcome(input: LeadWhatsAppInput): Promise<LeadWhatsAppResult> {
    if (this.config.whatsappMode !== "provider") {
      return {
        status: "PENDING",
        mode: "manual"
      };
    }

    if (!this.provider) {
      return { status: "FAILED", mode: "provider", error: "WHATSAPP_PROVIDER_NOT_CONFIGURED" };
    }

    const message = welcomeMessage(input.firstName, input.interestLabel);
    try {
      const result = await this.provider.send({ recipient: input.phoneE164, message });
      return {
        status: "SENT",
        mode: "provider",
        providerMessageId: normalizeProviderMessageId(result.providerMessageId)
      };
    } catch (error) {
      return {
        status: "FAILED",
        mode: "provider",
        error: providerFailureCode(error)
      };
    }
  }
}

function welcomeMessage(firstName: string, interestLabel: string): string {
  return [
    `Hola ${firstName} 👋`,
    "",
    "¡Gracias por contactar a Kaklen!",
    "",
    `Recibimos correctamente tu solicitud sobre ${interestLabel}.`,
    "",
    "Nuestro equipo revisará la información y se comunicará contigo muy pronto.",
    "",
    "Mientras tanto, puedes conocer más de nosotros en Instagram: @kaklen.cl",
    "",
    "Kaklen",
    "Invertimos hoy, construimos el mañana."
  ].join("\n");
}
