#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyPdfMoneySource } from "./pdf-money-parity-core.mjs";

const file = resolve(process.argv[2] ?? "apps/api/src/quotations/quotation-document.service.ts");
const findings = verifyPdfMoneySource(file, readFileSync(file, "utf8"));

if (findings.length > 0) {
  console.error("PDF MONEY PARITY FAILED");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log("PDF MONEY PARITY PASSED");
