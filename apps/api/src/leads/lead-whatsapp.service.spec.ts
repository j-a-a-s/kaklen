import type { WhatsAppProvider } from "../whatsapp/whatsapp-provider";
import { LeadWhatsAppService } from "./lead-whatsapp.service";

describe("LeadWhatsAppService", () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it("records a manual follow-up without claiming provider delivery", async () => {
    process.env.WHATSAPP_MODE = "manual";
    const provider: WhatsAppProvider = { send: jest.fn() };
    const service = new LeadWhatsAppService(provider);

    const result = await service.sendWelcome({
      firstName: "Ángela",
      phoneE164: "+56912345678",
      interestLabel: "una asesoría"
    });

    expect(result.status).toBe("PENDING");
    expect(result.mode).toBe("manual");
    expect(result).not.toHaveProperty("waUrl");
    expect(provider.send).not.toHaveBeenCalled();
  });

  it("fails closed when provider mode has no registered provider", async () => {
    process.env.WHATSAPP_MODE = "provider";
    const service = new LeadWhatsAppService();

    await expect(
      service.sendWelcome({
        firstName: "Ada",
        phoneE164: "+56912345678",
        interestLabel: "Kaklen"
      })
    ).resolves.toMatchObject({
      status: "FAILED",
      mode: "provider",
      error: "WHATSAPP_PROVIDER_NOT_CONFIGURED"
    });
  });

  it("does not expose provider exception messages", async () => {
    process.env.WHATSAPP_MODE = "provider";
    const provider: WhatsAppProvider = {
      send: jest.fn().mockRejectedValue(new Error("Bearer top-secret-token"))
    };
    const service = new LeadWhatsAppService(provider);

    const result = await service.sendWelcome({
      firstName: "Ada",
      phoneE164: "+56912345678",
      interestLabel: "Kaklen"
    });

    expect(result).toMatchObject({
      status: "FAILED",
      mode: "provider",
      error: "WHATSAPP_SEND_FAILED"
    });
    expect(JSON.stringify(result)).not.toContain("top-secret-token");
  });

  it("normalizes the provider message identifier", async () => {
    process.env.WHATSAPP_MODE = "provider";
    const provider: WhatsAppProvider = {
      send: jest.fn().mockResolvedValue({ providerMessageId: " message\r\n-42 " })
    };
    const service = new LeadWhatsAppService(provider);

    await expect(
      service.sendWelcome({
        firstName: "Ada",
        phoneE164: "+56912345678",
        interestLabel: "Kaklen"
      })
    ).resolves.toMatchObject({
      status: "SENT",
      providerMessageId: "message-42"
    });
  });
});
