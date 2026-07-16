#!/usr/bin/env node
import { createDemoPrismaClient, verifyDemoData } from "./demo-data.mjs";

const prisma = createDemoPrismaClient();

try {
  const result = await verifyDemoData(prisma);
  if (!result.ok) {
    console.error("KAKLEN DEMO VERIFY");
    console.error("DEMO DATA INVALID");
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log("DEMO DATA READY");
    console.log("");
    console.log(`Usuarios: ${result.counts.users}`);
    console.log(`Organizaciones: ${result.counts.organizations}`);
    console.log(`Clientes: ${result.counts.clients}`);
    console.log(`Catálogo: ${result.counts.catalogItems}`);
    console.log(`Cotizaciones: ${result.counts.quotations}`);
    console.log(`Eventos: ${result.counts.events}`);
    console.log("");
    console.log(`RUT válidos: ${result.checks.ruts ? "OK" : "ERROR"}`);
    console.log(`Contraseñas hasheadas: ${result.checks.passwords ? "OK" : "ERROR"}`);
    console.log(`Totales: ${result.checks.totals ? "OK" : "ERROR"}`);
    console.log(`Relaciones: ${result.checks.relationships ? "OK" : "ERROR"}`);
    console.log(`Aislamiento multiempresa: ${result.checks.isolation ? "OK" : "ERROR"}`);
    console.log(`Registros huérfanos: ${result.checks.orphans}`);
    console.log(`Huella: ${result.fingerprint.slice(0, 16)}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "No fue posible verificar el dataset demo.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
