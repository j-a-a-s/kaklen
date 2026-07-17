import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { WhatsAppNotificationStatus } from "@prisma/client";
import { createPublicToken, hashPublicToken } from "../quotation-portal/public-token";
import { WhatsAppNotificationService } from "./whatsapp-notification.service";

describe("WhatsAppNotificationService", () => {
  beforeEach(() => {
    process.env.APP_PUBLIC_URL = "http://localhost:4200";
    process.env.WHATSAPP_MODE = "manual";
    process.env.WHATSAPP_HASH_SECRET = "whatsapp-test-secret-at-least-32-characters";
  });

  it("prepares a minimal wa.me message without claiming automatic delivery", async () => {
    const token = createPublicToken();
    const prisma = makePrisma();
    const service = new WhatsAppNotificationService(prisma as never);

    const result = await service.prepare("org-1", "quotation-1", "user-1", { publicToken: token, locale: "es" });

    expect(result.mode).toBe("manual");
    expect(result.status).toBe(WhatsAppNotificationStatus.PREPARED);
    expect(result.waUrl).toContain("https://wa.me/56912345678?text=");
    expect(result.message).toContain(`/es/p/quotations/${token}`);
    expect(result.message).not.toContain("119000");
    expect(prisma.quotationPublicLink.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tokenHash: hashPublicToken(token) })
    }));
    expect(prisma.whatsAppNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: WhatsAppNotificationStatus.PREPARED, recipientHash: expect.stringMatching(/^[a-f0-9]{64}$/) })
    });
  });

  it("refuses provider mode when no real adapter is configured", async () => {
    process.env.WHATSAPP_MODE = "provider";
    const service = new WhatsAppNotificationService(makePrisma() as never);

    await expect(service.prepare("org-1", "quotation-1", "user-1", { publicToken: createPublicToken() }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("rejects an unavailable link or recipient", async () => {
    const prisma = makePrisma();
    prisma.quotationPublicLink.findFirst.mockResolvedValueOnce(null as never);
    const service = new WhatsAppNotificationService(prisma as never);

    await expect(service.prepare("org-1", "quotation-1", "user-1", { publicToken: createPublicToken() }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it("supports localized manual messages", async () => {
    const english = await new WhatsAppNotificationService(makePrisma() as never)
      .prepare("org-1", "quotation-1", "user-1", { publicToken: createPublicToken(), locale: "en" });
    const portuguese = await new WhatsAppNotificationService(makePrisma() as never)
      .prepare("org-1", "quotation-1", "user-1", { publicToken: createPublicToken(), locale: "pt-BR" });

    expect(english.message).toContain("Review your quotation");
    expect(portuguese.message).toContain("Revise sua cotação");
  });

  it("uses a configured provider and records successful delivery", async () => {
    process.env.WHATSAPP_MODE = "provider";
    const prisma = makePrisma();
    const provider = { send: jest.fn(async () => ({ providerMessageId: "provider-1" })) };
    prisma.whatsAppNotification.update.mockImplementationOnce(async ({ data }) => ({ id: "wa-1", ...data }));
    const service = new WhatsAppNotificationService(prisma as never, provider);

    await expect(service.prepare("org-1", "quotation-1", "user-1", { publicToken: createPublicToken() }))
      .resolves.toMatchObject({ mode: "provider", status: WhatsAppNotificationStatus.SENT });
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({ recipient: "+56912345678" }));
  });

  it("records provider failure without claiming delivery", async () => {
    process.env.WHATSAPP_MODE = "provider";
    const prisma = makePrisma();
    const provider = { send: jest.fn(async () => { throw new Error("provider unavailable"); }) };
    const service = new WhatsAppNotificationService(prisma as never, provider);

    await expect(service.prepare("org-1", "quotation-1", "user-1", { publicToken: createPublicToken() }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.whatsAppNotification.update).toHaveBeenCalledWith({
      where: { id: "wa-1" },
      data: { status: WhatsAppNotificationStatus.FAILED, failedAt: expect.any(Date) }
    });
  });
});

function makePrisma() {
  return {
    quotationPublicLink: {
      findFirst: jest.fn(async () => ({
        id: "link-1",
        quotation: { client: { whatsapp: "+56 9 1234 5678" } }
      }))
    },
    whatsAppNotification: {
      create: jest.fn(async ({ data }: { data: { status: WhatsAppNotificationStatus } }) => ({ id: "wa-1", ...data })),
      update: jest.fn(async ({ data }: { data: { status: WhatsAppNotificationStatus } }) => ({ id: "wa-1", ...data }))
    }
  };
}
