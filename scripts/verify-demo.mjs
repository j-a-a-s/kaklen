#!/usr/bin/env node
import { createDemoPrismaClient, verifyDemoData } from "./demo-data.mjs";

const prisma = createDemoPrismaClient();

try {
  const result = await verifyDemoData(prisma);
  console.log("KAKLEN DEMO VERIFY");
  if (!result.ok) {
    console.error("DEMO DATA INVALID");
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log(`✓ Usuarios: ${result.counts.users}`);
    console.log(`✓ Organizaciones: ${result.counts.organizations}`);
    console.log(`✓ Clientes: ${result.counts.clients}`);
    console.log(`✓ Catálogo: ${result.counts.catalogItems}`);
    console.log(`✓ Cotizaciones: ${result.counts.quotations}`);
    console.log(`✓ Eventos: ${result.counts.events}`);
    console.log("✓ RUT, totales, referencias, aislamiento y registros huérfanos");
    console.log("DEMO DATA VERIFIED");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "No fue posible verificar el dataset demo.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
