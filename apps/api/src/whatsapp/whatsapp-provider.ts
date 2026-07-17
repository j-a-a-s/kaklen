export interface WhatsAppProviderMessage {
  recipient: string;
  message: string;
}

export interface WhatsAppProviderResult {
  providerMessageId: string;
}

export interface WhatsAppProvider {
  send(message: WhatsAppProviderMessage): Promise<WhatsAppProviderResult>;
}

export const WHATSAPP_PROVIDER = Symbol("WHATSAPP_PROVIDER");
