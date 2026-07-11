#!/usr/bin/env node
import { checkDatabase, formatDatabaseTarget, readDatabaseUrl, suggestionForCheck } from "./local-db-utils.mjs";

const databaseUrl = readDatabaseUrl();
const result = await checkDatabase(databaseUrl);

if (result.ok) {
  console.log("✓ PostgreSQL encontrado");
  console.log(`✓ Conexion OK: ${formatDatabaseTarget(result.parsed)}`);
  process.exit(0);
}

if (result.parsed) {
  console.error(`✗ ${result.message}`);
  console.error(`Destino: ${formatDatabaseTarget(result.parsed)}`);
} else {
  console.error(`✗ ${result.message}`);
}
console.error("");
console.error("Sugerencia:");
console.error(suggestionForCheck(result));
process.exit(1);
