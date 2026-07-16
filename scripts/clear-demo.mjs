#!/usr/bin/env node
import { clearDemoData, createDemoPrismaClient } from "./demo-data.mjs";

const prisma = createDemoPrismaClient();

try {
  const removed = await clearDemoData(prisma);
  console.log("KAKLEN DEMO CLEAR");
  console.log(`✓ Organizaciones demo eliminadas: ${removed.organizations}`);
  console.log(`✓ Usuarios demo eliminados: ${removed.users}`);
  console.log("✓ Datos ajenos al dataset demo preservados");
} catch (error) {
  console.error(error instanceof Error ? error.message : "No fue posible limpiar el dataset demo.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
