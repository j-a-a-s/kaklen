#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ENVIRONMENT_DOCUMENT_PATH,
  LOCAL_EXAMPLE_PATH,
  PRODUCTION_EXAMPLE_PATH,
  readEnvironmentManifest,
  renderEnvironmentExample,
  renderEnvironmentMarkdown,
  validateEnvironmentManifest
} from "./environment-contract-core.mjs";

const manifest = readEnvironmentManifest();
const errors = validateEnvironmentManifest(manifest);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

writeFileSync(resolve(LOCAL_EXAMPLE_PATH), renderEnvironmentExample(manifest, "local"));
writeFileSync(resolve(PRODUCTION_EXAMPLE_PATH), renderEnvironmentExample(manifest, "production"));
writeFileSync(resolve(ENVIRONMENT_DOCUMENT_PATH), renderEnvironmentMarkdown(manifest));
console.log("✓ Environment examples and documentation updated from the manifest.");
