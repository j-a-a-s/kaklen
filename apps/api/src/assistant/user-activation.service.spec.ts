import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UserActivationService } from "./user-activation.service";

describe("UserActivationService", () => {
  const organization: { legalName: string; taxId: string | null; country: string } = { legalName: "Kaklen Demo SpA", taxId: "76111001K", country: "CL" };

  function createService(counts: number[], currentOrganization: typeof organization | null = organization) {
    const prisma = {
      organization: { findFirst: jest.fn().mockResolvedValue(currentOrganization) },
      client: { count: jest.fn().mockResolvedValue(counts[0] ?? 0) },
      catalogItem: { count: jest.fn().mockResolvedValue(counts[1] ?? 0) },
      quotation: { count: jest.fn().mockResolvedValueOnce(counts[2] ?? 0).mockResolvedValueOnce(counts[3] ?? 0).mockResolvedValueOnce(counts[4] ?? 0) },
      event: { count: jest.fn().mockResolvedValue(counts[5] ?? 0) }
    };
    return { service: new UserActivationService(prisma as unknown as PrismaService), prisma };
  }

  it("derives incomplete activation without persisting duplicate progress", async () => {
    const { service, prisma } = createService([1, 1, 1, 0, 0, 0]);

    await expect(service.calculate("org-a")).resolves.toEqual({
      completedSteps: ["organization_configured", "first_client_created", "first_catalog_item_created", "first_quotation_created"],
      totalSteps: 7,
      percentage: 57,
      currentStep: "first_quotation_sent",
      nextRecommendedAction: "first_quotation_sent",
      isCompleted: false
    });
    expect(prisma.organization.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "org-a" }) }));
  });

  it("reports complete activation when all business evidence exists", async () => {
    const { service } = createService([2, 3, 4, 2, 1, 1]);

    await expect(service.calculate("org-a")).resolves.toMatchObject({
      totalSteps: 7,
      percentage: 100,
      currentStep: null,
      nextRecommendedAction: "create_opportunity",
      isCompleted: true
    });
  });

  it("requires a configured Chilean organization and rejects an unknown tenant", async () => {
    const incomplete = createService([0, 0, 0, 0, 0, 0], { ...organization, taxId: null });
    await expect(incomplete.service.calculate("org-a")).resolves.toMatchObject({ currentStep: "organization_configured", percentage: 0 });

    const missing = createService([], null);
    await expect(missing.service.calculate("org-missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
