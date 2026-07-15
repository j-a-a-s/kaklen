#!/usr/bin/env node
import { createRequire } from "node:module";
import { Prisma, PrismaClient } from "@prisma/client";

const requireApi = createRequire(new URL("../apps/api/package.json", import.meta.url));
const argon2 = requireApi("argon2");
const prisma = new PrismaClient();

const demo = {
  email: "admin.demo@kaklen.local",
  password: "KaklenDemo123!",
  organizationSlug: "kaklen-demo"
};

async function main() {
  const passwordHash = await argon2.hash(demo.password, { type: argon2.argon2id });

  const user = await prisma.user.upsert({
    where: { email: demo.email },
    create: {
      email: demo.email,
      firstName: "Admin",
      lastName: "Demo",
      passwordHash,
      locale: "es"
    },
    update: {
      firstName: "Admin",
      lastName: "Demo",
      locale: "es"
    }
  });

  const organization = await prisma.organization.upsert({
    where: { slug: demo.organizationSlug },
    create: {
      name: "Kaklen Demo",
      slug: demo.organizationSlug,
      legalName: "Kaklen Demo SpA",
      taxId: "76123456-7",
      country: "CL",
      currency: "CLP",
      timezone: "America/Santiago",
      dateFormat: "dd-MM-yyyy",
      numberFormat: "es",
      defaultLocale: "es",
      createdByUserId: user.id
    },
    update: {
      name: "Kaklen Demo",
      legalName: "Kaklen Demo SpA",
      country: "CL",
      currency: "CLP",
      timezone: "America/Santiago",
      dateFormat: "dd-MM-yyyy",
      numberFormat: "es",
      defaultLocale: "es"
    }
  });

  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id
      }
    },
    create: {
      organizationId: organization.id,
      userId: user.id,
      role: "OWNER"
    },
    update: {
      role: "OWNER",
      status: "ACTIVE"
    }
  });

  const client = await ensureClient(organization.id, user.id);
  const product = await ensureCatalogItem(organization.id, user.id, {
    type: "PRODUCT",
    sku: "DEMO-PROD-001",
    code: "DEMO-PRODUCT",
    name: "Producto demo",
    unit: "unidad",
    cost: "12000.00",
    price: "25000.00",
    taxPercent: "19.00"
  });
  await ensureCatalogItem(organization.id, user.id, {
    type: "SERVICE",
    sku: null,
    code: "DEMO-SERVICE",
    name: "Servicio demo",
    unit: "hora",
    cost: "18000.00",
    price: "45000.00",
    taxPercent: "19.00"
  });

  const quotation = await ensureQuotation(organization.id, user.id, client.id, product.id);
  await ensureEvent(organization.id, user.id, client.id, quotation.id);

  console.log("KAKLEN DEMO SEED");
  console.log("✓ Usuario administrador local");
  console.log("✓ Organización demo");
  console.log("✓ Cliente demo");
  console.log("✓ Producto y servicio demo");
  console.log("✓ Cotización demo");
  console.log("✓ Evento demo");
  console.log("");
  console.log("Credenciales locales:");
  console.log(`Email: ${demo.email}`);
  console.log(`Password: ${demo.password}`);
}

async function ensureClient(organizationId, userId) {
  const existing = await prisma.client.findFirst({
    where: { organizationId, displayName: "Comercial Demo SpA" }
  });
  if (existing) return existing;

  return prisma.client.create({
    data: {
      organizationId,
      type: "LEGAL_ENTITY",
      status: "ACTIVE",
      displayName: "Comercial Demo SpA",
      legalName: "Comercial Demo SpA",
      taxId: "96500540-1",
      email: "cliente.demo@kaklen.local",
      country: "CL",
      city: "Santiago",
      createdByUserId: userId
    }
  });
}

async function ensureCatalogItem(organizationId, userId, item) {
  return prisma.catalogItem.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: item.code
      }
    },
    create: {
      organizationId,
      type: item.type,
      status: "ACTIVE",
      sku: item.sku,
      code: item.code,
      name: item.name,
      unit: item.unit,
      cost: new Prisma.Decimal(item.cost),
      price: new Prisma.Decimal(item.price),
      taxPercent: new Prisma.Decimal(item.taxPercent),
      currency: "CLP",
      trackInventory: item.type === "PRODUCT",
      createdByUserId: userId
    },
    update: {
      status: "ACTIVE",
      sku: item.sku,
      name: item.name,
      unit: item.unit,
      cost: new Prisma.Decimal(item.cost),
      price: new Prisma.Decimal(item.price),
      taxPercent: new Prisma.Decimal(item.taxPercent),
      currency: "CLP",
      trackInventory: item.type === "PRODUCT"
    }
  });
}

async function ensureQuotation(organizationId, userId, clientId, catalogItemId) {
  const existing = await prisma.quotation.findFirst({
    where: { organizationId, number: "Q-DEMO-001", version: 1 }
  });
  if (existing) return existing;

  const subtotal = new Prisma.Decimal("50000.00");
  const taxTotal = new Prisma.Decimal("9500.00");
  const total = new Prisma.Decimal("59500.00");

  return prisma.quotation.create({
    data: {
      organizationId,
      clientId,
      number: "Q-DEMO-001",
      version: 1,
      status: "APPROVED",
      issueDate: new Date("2026-07-15T00:00:00.000Z"),
      validUntil: new Date("2026-08-15T00:00:00.000Z"),
      currency: "CLP",
      subtotal,
      discountTotal: new Prisma.Decimal("0.00"),
      taxTotal,
      total,
      createdByUserId: userId,
      approvedAt: new Date("2026-07-15T12:00:00.000Z"),
      items: {
        create: {
          catalogItemId,
          type: "PRODUCT",
          code: "DEMO-PRODUCT",
          name: "Producto demo",
          quantity: new Prisma.Decimal("2.000"),
          unit: "unidad",
          unitPrice: new Prisma.Decimal("25000.00"),
          discountType: "NONE",
          discountValue: new Prisma.Decimal("0.00"),
          taxPercent: new Prisma.Decimal("19.00"),
          subtotal,
          discountTotal: new Prisma.Decimal("0.00"),
          taxTotal,
          total,
          sortOrder: 1
        }
      },
      history: {
        create: {
          organizationId,
          previousStatus: null,
          newStatus: "APPROVED",
          changedByUserId: userId,
          note: "demo seed"
        }
      }
    }
  });
}

async function ensureEvent(organizationId, userId, clientId, quotationId) {
  return prisma.event.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "EV-DEMO-001"
      }
    },
    create: {
      organizationId,
      clientId,
      quotationId,
      code: "EV-DEMO-001",
      name: "Evento demo",
      status: "CONFIRMED",
      startAt: new Date("2026-08-20T14:00:00.000Z"),
      endAt: new Date("2026-08-20T18:00:00.000Z"),
      timezone: "America/Santiago",
      venueName: "Centro demo",
      city: "Santiago",
      country: "CL",
      budget: new Prisma.Decimal("59500.00"),
      currency: "CLP",
      createdByUserId: userId
    },
    update: {
      clientId,
      quotationId,
      name: "Evento demo",
      status: "CONFIRMED",
      startAt: new Date("2026-08-20T14:00:00.000Z"),
      endAt: new Date("2026-08-20T18:00:00.000Z"),
      timezone: "America/Santiago",
      venueName: "Centro demo",
      city: "Santiago",
      country: "CL",
      budget: new Prisma.Decimal("59500.00"),
      currency: "CLP"
    }
  });
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "No fue posible crear el seed local.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
