import { BadRequestException } from "@nestjs/common";
import { LeadInterest, LeadStatus } from "@prisma/client";
import type { MailService } from "../notifications/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { DistributedRateLimitService } from "../security/distributed-rate-limit.service";
import { ERROR_CODES } from "../common/error-codes";
import type { CreateLeadDto } from "./dto/lead.dto";
import type { LeadWhatsAppService } from "./lead-whatsapp.service";
import { LeadsService } from "./leads.service";

interface TransactionMock {
  lead: {
    create: jest.Mock;
    update: jest.Mock;
  };
  leadEvent: {
    create: jest.Mock;
  };
}

describe("LeadsService", () => {
  const leadId = "5d0786e8-591d-47a2-8854-e28e3452c4c7";
  let transaction: TransactionMock;
  let prisma: {
    $transaction: jest.Mock;
    leadEvent: { create: jest.Mock };
  };
  let mail: { send: jest.Mock };
  let whatsapp: { sendWelcome: jest.Mock };
  let rateLimits: { hashSensitive: jest.Mock };
  let service: LeadsService;

  beforeEach(() => {
    transaction = {
      lead: {
        create: jest.fn().mockResolvedValue({
          id: leadId,
          firstName: "Ángela",
          lastName: "Pérez",
          email: "angela@example.com",
          interestType: LeadInterest.KAKLEN,
          message: "Necesito conocer la plataforma."
        }),
        update: jest.fn().mockResolvedValue({})
      },
      leadEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    prisma = {
      $transaction: jest.fn(
        async (callback: (client: TransactionMock) => Promise<unknown>) =>
          callback(transaction)
      ),
      leadEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    mail = { send: jest.fn().mockResolvedValue({}) };
    whatsapp = {
      sendWelcome: jest.fn().mockResolvedValue({ status: "PENDING", mode: "manual" })
    };
    rateLimits = {
      hashSensitive: jest.fn((value: string) => `hmac:${value}`)
    };
    service = new LeadsService(
      prisma as unknown as PrismaService,
      mail as unknown as MailService,
      whatsapp as unknown as LeadWhatsAppService,
      rateLimits as unknown as DistributedRateLimitService
    );
  });

  it("persists normalized lead data and pseudonymized consent evidence", async () => {
    const result = await service.create(validDto(), {
      ipAddress: " 203.0.113.9 ",
      userAgent: " browser/1.0 "
    });

    const createInput = transaction.lead.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(result).toEqual({
      leadReference: leadId,
      whatsapp: { scheduled: false }
    });
    expect(createInput.data).toMatchObject({
      email: "angela@example.com",
      phoneCountryCode: "CL",
      phoneE164: "+56912345678",
      privacyConsent: true,
      consentIpHash: "hmac:203.0.113.9",
      userAgentHash: "hmac:browser/1.0",
      landingPage: "/contacto",
      referrer: "https://example.com/campaign",
      status: LeadStatus.NEW
    });
    expect(JSON.stringify(createInput.data)).not.toContain("secret");
  });

  it("escapes hostile content in HTML email and blocks header injection", async () => {
    transaction.lead.create.mockResolvedValueOnce({
      id: leadId,
      firstName: "Ada\r\nBcc: attacker@example.com",
      lastName: "Lovelace",
      email: "ada@example.com",
      interestType: LeadInterest.KAKLEN,
      message: `<img src="x" onerror="alert(1)"> Necesito ayuda`
    });

    await service.create(
      validDto({
        firstName: "Ada\r\nBcc: attacker@example.com",
        lastName: "Lovelace",
        email: "ada@example.com",
        message: `<img src="x" onerror="alert(1)"> Necesito ayuda`
      }),
      {}
    );

    const mailInput = mail.send.mock.calls[0]?.[0] as {
      subject: string;
      html: string;
    };
    expect(mailInput.subject).not.toMatch(/[\r\n]/u);
    expect(mailInput.html).toContain("&lt;img");
    expect(mailInput.html).not.toContain(`<img src="x"`);
  });

  it("keeps the successful capture when email delivery fails", async () => {
    mail.send.mockRejectedValueOnce(new Error("SMTP unavailable"));

    await expect(service.create(validDto(), {})).resolves.toEqual({
      leadReference: leadId,
      whatsapp: { scheduled: false }
    });
    expect(prisma.leadEvent.create).toHaveBeenCalledWith({
      data: { leadId, eventType: "notification.email.failed" }
    });
  });

  it("keeps the successful capture when WhatsApp persistence fails", async () => {
    whatsapp.sendWelcome.mockResolvedValueOnce({ status: "SENT", mode: "provider" });
    prisma.$transaction
      .mockImplementationOnce(
        async (callback: (client: TransactionMock) => Promise<unknown>) =>
          callback(transaction)
      )
      .mockRejectedValueOnce(new Error("database unavailable"));

    await expect(
      service.create(validDto({ whatsappConsent: true }), {})
    ).resolves.toEqual({
      leadReference: leadId,
      whatsapp: { scheduled: false }
    });
    expect(prisma.leadEvent.create).toHaveBeenCalledWith({
      data: { leadId, eventType: "whatsapp.processing.failed" }
    });
  });

  it("does not report a manual WhatsApp follow-up as delivered", async () => {
    const result = await service.create(validDto({ whatsappConsent: true }), {});

    expect(result.whatsapp.scheduled).toBe(false);
    expect(transaction.lead.update).toHaveBeenCalledWith({
      where: { id: leadId },
      data: {
        whatsappStatus: "PENDING",
        whatsappSentAt: null,
        whatsappError: null
      }
    });
  });

  it("rejects missing privacy consent with a stable code", async () => {
    await expectBadRequest(
      service.create(validDto({ privacyConsent: false }), {}),
      ERROR_CODES.privacyConsentRequired,
      "Privacy policy consent is required"
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid phone with a stable code", async () => {
    await expectBadRequest(
      service.create(validDto({ phone: "not-a-phone" }), {}),
      ERROR_CODES.leadPhoneInvalid,
      "Phone number is invalid"
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

function validDto(overrides: Partial<CreateLeadDto> = {}): CreateLeadDto {
  return {
    firstName: " Ángela ",
    lastName: " Pérez ",
    email: " ANGELA@example.com ",
    phoneCountryCode: "cl",
    phone: "9 1234 5678",
    company: "Kaklen",
    position: "Gerencia",
    country: "Chile",
    interestType: "KAKLEN",
    message: "Necesito conocer la plataforma.",
    privacyConsent: true,
    whatsappConsent: false,
    landingPage: " /contacto ",
    referrer: "https://example.com/campaign?token=secret#details",
    utmSource: " linkedin ",
    ...overrides
  };
}

async function expectBadRequest(
  promise: Promise<unknown>,
  code: string,
  message: string
): Promise<void> {
  try {
    await promise;
    throw new Error("Expected BadRequestException");
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toEqual({ code, message });
  }
}
