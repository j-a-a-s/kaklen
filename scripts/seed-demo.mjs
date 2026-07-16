#!/usr/bin/env node
import { createDemoPrismaClient, DEMO_ORGANIZATIONS, DEMO_PASSWORD, seedDemoData } from "./demo-data.mjs";

const prisma = createDemoPrismaClient();

try {
  console.log("KAKLEN DEMO SEED");
  const result = await seedDemoData(prisma);
  console.log(`✓ Usuarios OWNER: ${result.counts.users}`);
  console.log(`✓ Organizaciones aisladas: ${result.counts.organizations}`);
  console.log(`✓ Clientes: ${result.counts.clients}`);
  console.log(`✓ Catálogo: ${result.counts.catalogItems}`);
  console.log(`✓ Cotizaciones: ${result.counts.quotations}`);
  console.log(`✓ Eventos: ${result.counts.events}`);
  console.log(`✓ Huella determinista: ${result.fingerprint.slice(0, 16)}`);
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
