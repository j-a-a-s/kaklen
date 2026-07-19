import { NotFoundException } from "@nestjs/common";
import {
  ClientType,
  Prisma,
  PrismaClient,
  QuotationDiscountType,
  QuotationItemType
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { QuotationsService } from "./quotations.service";

const databaseUrl = process.env.DATABASE_URL ??
  `postgresql://kaklen:kaklen_dev_password@localhost:${process.env.POSTGRES_PORT ?? "5432"}/kaklen_dev?schema=public`;

describe("QuotationsService PostgreSQL repair concurrency", () => {
  const firstClient = new PrismaClient({ datasourceUrl: databaseUrl });
  const secondClient = new PrismaClient({ datasourceUrl: databaseUrl });

  beforeAll(async () => {
    await Promise.all([firstClient.$connect(), secondClient.$connect()]);
  });

  afterAll(async () => {
    await Promise.all([firstClient.$disconnect(), secondClient.$disconnect()]);
  });

  it("retries a real P2034 without partial writes, duplicate audit attempts, or tenant leakage", async () => {
    const fixture = await createFixture(firstClient);
    try {
      const barrier = new FirstRepairReadBarrier(2);
      const coordinatedFirst = coordinateInitialRepairRead(
        firstClient,
        fixture.organizationId,
        fixture.quotationId,
        barrier
      );
      const coordinatedSecond = coordinateInitialRepairRead(
        secondClient,
        fixture.organizationId,
        fixture.quotationId,
        barrier
      );
      let realRetryCount = 0;
      const recordRetry = async (_milliseconds: number): Promise<void> => {
        realRetryCount += 1;
      };
      const firstService = new QuotationsService(
        coordinatedFirst as unknown as PrismaService,
        undefined,
        undefined,
        recordRetry
      );
      const secondService = new QuotationsService(
        coordinatedSecond as unknown as PrismaService,
        undefined,
        undefined,
        recordRetry
      );

      const repaired = await Promise.all([
        firstService.recalculateTotals(fixture.organizationId, fixture.quotationId, fixture.userId),
        secondService.recalculateTotals(fixture.organizationId, fixture.quotationId, fixture.userId)
      ]);

      expect(barrier.observedTotals).toEqual(["2381", "2381"]);
      expect(realRetryCount).toBe(1);
      expect(repaired.map((quotation) => quotation.total.toString())).toEqual(["2380", "2380"]);

      const persisted = await firstClient.quotation.findUnique({
        where: { id: fixture.quotationId },
        include: { items: { orderBy: { sortOrder: "asc" } } }
      });
      expect(persisted).not.toBeNull();
      expect(persisted).toMatchObject({
        organizationId: fixture.organizationId,
        subtotal: new Prisma.Decimal("2000"),
        discountTotal: new Prisma.Decimal("0"),
        taxTotal: new Prisma.Decimal("380"),
        total: new Prisma.Decimal("2380")
      });
      expect(persisted?.items).toHaveLength(1);
      expect(persisted?.items[0]).toMatchObject({
        subtotal: new Prisma.Decimal("2000"),
        discountTotal: new Prisma.Decimal("0"),
        taxTotal: new Prisma.Decimal("380"),
        total: new Prisma.Decimal("2380")
      });
      expect(await firstClient.organizationAuditLog.count({
        where: {
          organizationId: fixture.organizationId,
          action: "quotation.money_recalculated",
          targetId: fixture.quotationId
        }
      })).toBe(2);

      await expect(firstService.recalculateTotals(
        fixture.otherOrganizationId,
        fixture.quotationId,
        fixture.userId
      )).rejects.toBeInstanceOf(NotFoundException);
      expect(await firstClient.quotation.findUnique({
        where: { id: fixture.otherQuotationId },
        select: { organizationId: true, total: true, items: { select: { total: true } } }
      })).toEqual({
        organizationId: fixture.otherOrganizationId,
        total: new Prisma.Decimal("1191"),
        items: [{ total: new Prisma.Decimal("1190") }]
      });
      expect(await firstClient.organizationAuditLog.count({
        where: {
          organizationId: fixture.otherOrganizationId,
          action: "quotation.money_recalculated"
        }
      })).toBe(0);
    } finally {
      await firstClient.organization.deleteMany({
        where: { id: { in: [fixture.organizationId, fixture.otherOrganizationId] } }
      });
      await firstClient.user.deleteMany({ where: { id: fixture.userId } });
    }
  }, 30_000);
});

class FirstRepairReadBarrier {
  readonly observedTotals: string[] = [];
  private arrivals = 0;
  private release: (() => void) | null = null;
  private readonly released: Promise<void>;

  constructor(private readonly participants: number) {
    this.released = new Promise<void>((resolve) => {
      this.release = resolve;
    });
  }

  async arrive(total: string): Promise<void> {
    this.observedTotals.push(total);
    this.arrivals += 1;
    if (this.arrivals === this.participants) {
      this.release?.();
    }
    await this.released;
  }
}

function coordinateInitialRepairRead(
  client: PrismaClient,
  organizationId: string,
  quotationId: string,
  barrier: FirstRepairReadBarrier
) {
  let initialReadPending = true;
  return client.$extends({
    query: {
      quotation: {
        async findFirst({ args, query }) {
          const quotation = await query(args);
          if (
            initialReadPending &&
            quotation &&
            quotation.total !== undefined &&
            args.where?.id === quotationId &&
            args.where.organizationId === organizationId
          ) {
            initialReadPending = false;
            await barrier.arrive(quotation.total.toString());
          }
          return quotation;
        }
      }
    }
  });
}

interface RepairFixture {
  userId: string;
  organizationId: string;
  quotationId: string;
  otherOrganizationId: string;
  otherQuotationId: string;
}

async function createFixture(prisma: PrismaClient): Promise<RepairFixture> {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `quotation-repair-${suffix}@integration.kaklen.local`,
      firstName: "Concurrency",
      lastName: "Test",
      passwordHash: "integration-test-only"
    }
  });
  const [organization, otherOrganization] = await Promise.all([
    prisma.organization.create({
      data: {
        name: `Repair organization ${suffix}`,
        slug: `repair-${suffix}`,
        createdByUserId: user.id
      }
    }),
    prisma.organization.create({
      data: {
        name: `Isolated organization ${suffix}`,
        slug: `isolated-${suffix}`,
        createdByUserId: user.id
      }
    })
  ]);
  const [client, otherClient] = await Promise.all([
    prisma.client.create({
      data: {
        organizationId: organization.id,
        type: ClientType.NATURAL_PERSON,
        displayName: "Concurrent client",
        firstName: "Concurrent",
        lastName: "Client",
        createdByUserId: user.id
      }
    }),
    prisma.client.create({
      data: {
        organizationId: otherOrganization.id,
        type: ClientType.NATURAL_PERSON,
        displayName: "Isolated client",
        firstName: "Isolated",
        lastName: "Client",
        createdByUserId: user.id
      }
    })
  ]);
  const quotation = await prisma.quotation.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      number: "QUO-CONCURRENT",
      issueDate: new Date("2026-07-01T00:00:00.000Z"),
      validUntil: new Date("2026-08-01T00:00:00.000Z"),
      currency: "CLP",
      globalDiscountPercent: new Prisma.Decimal("0"),
      subtotal: new Prisma.Decimal("2000"),
      discountTotal: new Prisma.Decimal("0"),
      taxTotal: new Prisma.Decimal("380"),
      total: new Prisma.Decimal("2380"),
      createdByUserId: user.id,
      items: {
        create: {
          type: QuotationItemType.SERVICE,
          code: "CONCURRENT-SERVICE",
          name: "Concurrent service",
          quantity: new Prisma.Decimal("2"),
          unit: "hour",
          unitPrice: new Prisma.Decimal("1000"),
          discountType: QuotationDiscountType.NONE,
          discountValue: new Prisma.Decimal("0"),
          taxPercent: new Prisma.Decimal("19"),
          subtotal: new Prisma.Decimal("2000"),
          discountTotal: new Prisma.Decimal("0"),
          taxTotal: new Prisma.Decimal("380"),
          total: new Prisma.Decimal("2380"),
          sortOrder: 0
        }
      }
    }
  });
  await prisma.quotation.update({
    where: { id: quotation.id },
    data: { total: new Prisma.Decimal("2381") }
  });
  const otherQuotation = await prisma.quotation.create({
    data: {
      organizationId: otherOrganization.id,
      clientId: otherClient.id,
      number: "QUO-ISOLATED",
      issueDate: new Date("2026-07-01T00:00:00.000Z"),
      validUntil: new Date("2026-08-01T00:00:00.000Z"),
      currency: "CLP",
      globalDiscountPercent: new Prisma.Decimal("0"),
      subtotal: new Prisma.Decimal("1000"),
      discountTotal: new Prisma.Decimal("0"),
      taxTotal: new Prisma.Decimal("190"),
      total: new Prisma.Decimal("1191"),
      createdByUserId: user.id,
      items: {
        create: {
          type: QuotationItemType.SERVICE,
          code: "ISOLATED-SERVICE",
          name: "Isolated service",
          quantity: new Prisma.Decimal("1"),
          unit: "hour",
          unitPrice: new Prisma.Decimal("1000"),
          discountType: QuotationDiscountType.NONE,
          discountValue: new Prisma.Decimal("0"),
          taxPercent: new Prisma.Decimal("19"),
          subtotal: new Prisma.Decimal("1000"),
          discountTotal: new Prisma.Decimal("0"),
          taxTotal: new Prisma.Decimal("190"),
          total: new Prisma.Decimal("1190"),
          sortOrder: 0
        }
      }
    }
  });

  return {
    userId: user.id,
    organizationId: organization.id,
    quotationId: quotation.id,
    otherOrganizationId: otherOrganization.id,
    otherQuotationId: otherQuotation.id
  };
}
