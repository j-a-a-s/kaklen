#!/usr/bin/env node
import { createDemoPrismaClient, DEMO_ORGANIZATIONS, DEMO_PASSWORD, seedDemoData } from "./demo-data.mjs";

const prisma = createDemoPrismaClient();

try {
  console.log("KAKLEN DEMO SEED");
  await seedDemoData(prisma);
  console.log("✓ 4 usuarios OWNER");
  console.log("✓ 4 organizaciones aisladas");
  console.log("✓ 40 clientes, 48 ítems de catálogo, 32 cotizaciones y 20 eventos");
  console.log("");
  console.log("Cuentas demo:");
  DEMO_ORGANIZATIONS.forEach((organization) => console.log(`- ${organization.email}`));
  console.log(`Contraseña: ${DEMO_PASSWORD}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "No fue posible crear el dataset demo.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
