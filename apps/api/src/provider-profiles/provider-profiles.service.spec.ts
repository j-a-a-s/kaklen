import { BadRequestException } from "@nestjs/common";
import { Prisma, ProviderProfileStatus, QuotationStatus } from "@prisma/client";
import { ProviderProfilesService } from "./provider-profiles.service";

describe("ProviderProfilesService", () => {
  it("does not show the recommendation before approval or payment", async () => {
    const service = new ProviderProfilesService(makePrisma() as never, portal(QuotationStatus.SENT) as never);

    await expect(service.recommendationShown("token")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("records an eligible recommendation after payment", async () => {
    const prisma = makePrisma();
    const service = new ProviderProfilesService(prisma as never, portal(QuotationStatus.SENT, new Date()) as never);

    await expect(service.recommendationShown("token")).resolves.toEqual({ recorded: true });
    expect(prisma.providerAnalyticsEvent.create).toHaveBeenCalledWith({
      data: { organizationId: "org-1", event: "RECOMMENDATION_SHOWN" }
    });
  });

  it("creates a reviewable profile only with valid country WhatsApp and analytics without PII", async () => {
    const prisma = makePrisma();
    const service = new ProviderProfilesService(prisma as never, portal(QuotationStatus.APPROVED) as never);

    const result = await service.create("token", {
      consent: true,
      category: " Fotografía ",
      description: " Producción fotográfica para eventos y empresas. ",
      country: "CL",
      whatsapp: "+56 9 1234 5678",
      currency: "clp",
      portfolioUrl: "https://portfolio.example.com"
    });

    expect(result.status).toBe(ProviderProfileStatus.IN_REVIEW);
    expect(prisma.providerProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ whatsapp: "+56912345678", currency: "CLP", consentAt: expect.any(Date) })
    }));
    const analyticsCall = prisma.providerAnalyticsEvent.createMany.mock.calls[0];
    expect(analyticsCall).toBeDefined();
    const analytics = analyticsCall ? analyticsCall[0].data : [];
    expect(JSON.stringify(analytics)).not.toContain("+56912345678");
    expect(JSON.stringify(analytics)).not.toContain("Fotografía");
  });

  it("normalizes optional location and price fields with explicit consent", async () => {
    const prisma = makePrisma();
    const service = new ProviderProfilesService(prisma as never, portal(QuotationStatus.APPROVED) as never);

    await service.create("token", {
      consent: true,
      category: " Producción ",
      description: " Coordinación profesional de eventos y proveedores. ",
      country: "CL",
      region: " Metropolitana ",
      city: " Santiago ",
      whatsapp: "+56 9 1234 5678",
      price: 75000,
      currency: "clp"
    });

    expect(prisma.providerProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        region: "Metropolitana",
        city: "Santiago",
        price: new Prisma.Decimal(75000),
        portfolioUrl: null
      }),
      update: expect.objectContaining({
        region: "Metropolitana",
        city: "Santiago",
        price: new Prisma.Decimal(75000),
        portfolioUrl: null
      })
    }));
  });

  it("rejects a fractional CLP provider price with a stable code", async () => {
    const service = new ProviderProfilesService(makePrisma() as never, portal(QuotationStatus.APPROVED) as never);

    await expect(service.create("token", {
      consent: true,
      category: "Producción",
      description: "Coordinación profesional de eventos y proveedores.",
      country: "CL",
      whatsapp: "+56 9 1234 5678",
      price: 75000.5,
      currency: "CLP"
    })).rejects.toMatchObject({ response: { code: "CLP_FRACTION_NOT_ALLOWED" } });
  });

  it("keeps admin review organization scoped", async () => {
    const prisma = makePrisma();
    prisma.providerProfile.findFirst.mockResolvedValueOnce(null as never);
    const service = new ProviderProfilesService(prisma as never, portal(QuotationStatus.APPROVED) as never);

    await expect(service.review("other-org", "profile-1", { status: "PUBLISHED" }))
      .rejects.toMatchObject({ status: 404 });
  });

  it("rejects a provider profile with a WhatsApp number invalid for its country", async () => {
    const service = new ProviderProfilesService(makePrisma() as never, portal(QuotationStatus.APPROVED) as never);

    await expect(service.create("token", {
      consent: true,
      category: "Eventos",
      description: "Producción integral para eventos corporativos.",
      country: "CL",
      whatsapp: "+5511912345678",
      currency: "CLP"
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lists profiles and applies published and archived review states", async () => {
    const prisma = makePrisma();
    const service = new ProviderProfilesService(prisma as never, portal(QuotationStatus.APPROVED) as never);

    await expect(service.list("org-1")).resolves.toHaveLength(1);
    await service.review("org-1", "profile-1", { status: "PUBLISHED" });
    expect(prisma.providerProfile.update).toHaveBeenLastCalledWith({
      where: { id: "profile-1" },
      data: {
        status: ProviderProfileStatus.PUBLISHED,
        reviewedAt: expect.any(Date),
        publishedAt: expect.any(Date)
      }
    });

    await service.review("org-1", "profile-1", { status: "ARCHIVED" });
    expect(prisma.providerProfile.update).toHaveBeenLastCalledWith({
      where: { id: "profile-1" },
      data: {
        status: ProviderProfileStatus.ARCHIVED,
        reviewedAt: expect.any(Date),
        publishedAt: null
      }
    });
  });
});

function portal(status: QuotationStatus, paidAt: Date | null = null) {
  return {
    resolve: jest.fn(async () => ({
      quotation: { organizationId: "org-1", clientId: "client-1", status, paidAt }
    }))
  };
}

function makePrisma() {
  const profile = {
    id: "profile-1",
    organizationId: "org-1",
    sourceClientId: "client-1",
    userId: null,
    category: "Fotografía",
    description: "Producción fotográfica para eventos y empresas.",
    country: "CL",
    region: null,
    city: null,
    whatsapp: "+56912345678",
    price: new Prisma.Decimal(0),
    currency: "CLP",
    portfolioUrl: null,
    status: ProviderProfileStatus.IN_REVIEW,
    consentAt: new Date(),
    reviewedAt: null,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const tx = {
    providerProfile: {
      upsert: jest.fn(async () => profile),
      findFirst: jest.fn(async () => profile),
      findMany: jest.fn(async () => [profile]),
      update: jest.fn(async () => profile)
    },
    providerAnalyticsEvent: {
      create: jest.fn(async () => ({ id: "analytics-1" })),
      createMany: jest.fn(async (_args: { data: unknown[] }) => ({ count: 2 }))
    }
  };
  return { ...tx, $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
}
