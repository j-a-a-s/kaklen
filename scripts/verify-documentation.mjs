#!/usr/bin/env node
import { verifyDocumentationContract } from "./documentation-contract-core.mjs";

try {
  const result = verifyDocumentationContract();
  if (result.errors.length > 0) throw new Error(result.errors.join("\n"));
  console.log(`✓ Markdown verificado: ${result.fileCount} archivos`);
  console.log("DOCUMENTATION CONTRACT PASSED");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Documentation contract verification failed.");
  process.exitCode = 1;
}
