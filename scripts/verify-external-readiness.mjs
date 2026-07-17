#!/usr/bin/env node

const requirements = [
  ["AWS_STAGING_VALIDATED", "AWS staging"],
  ["REAL_WHATSAPP_VALIDATED", "WhatsApp real"],
  ["PRODUCTION_PAYMENT_GATEWAY_VALIDATED", "gateway de pagos productivo"]
];
const missing = requirements.filter(([key]) => process.env[key] !== "true");

if (missing.length > 0) {
  console.error("EXTERNAL READINESS FAILED");
  for (const [key, label] of missing) console.error(`- ${label}: ${key}=true no fue validado`);
  process.exitCode = 1;
} else {
  console.log("✓ AWS staging, WhatsApp real y gateway productivo validados externamente");
}
