#!/usr/bin/env node
import { createDemoPrismaClient } from "./demo-data.mjs";
import { auditClpMoneyRecords } from "./db-money-audit-core.mjs";

const prisma = createDemoPrismaClient();

try {
  const [catalog, quotations, quotationItems, events, eventResources, payments, refunds, receipts, profiles] = await Promise.all([
    prisma.catalogItem.findMany({ where: { currency: "CLP" }, select: { id: true, cost: true, price: true } }),
    prisma.quotation.findMany({
      where: { currency: "CLP" },
      select: { id: true, subtotal: true, discountTotal: true, taxTotal: true, total: true }
    }),
    prisma.quotationItem.findMany({
      where: { quotation: { currency: "CLP" } },
      select: {
        id: true,
        unitPrice: true,
        discountType: true,
        discountValue: true,
        subtotal: true,
        discountTotal: true,
        taxTotal: true,
        total: true
      }
    }),
    prisma.event.findMany({ where: { currency: "CLP" }, select: { id: true, budget: true } }),
    prisma.eventResource.findMany({
      where: { event: { currency: "CLP" } },
      select: { id: true, unitCost: true }
    }),
    prisma.payment.findMany({ where: { currency: "CLP" }, select: { id: true, amount: true } }),
    prisma.paymentRefund.findMany({
      where: { payment: { currency: "CLP" } },
      select: { id: true, amount: true }
    }),
    prisma.paymentReceipt.findMany({
      where: { payment: { currency: "CLP" } },
      select: { id: true, metadata: true }
    }),
    prisma.providerProfile.findMany({ where: { currency: "CLP" }, select: { id: true, price: true } })
  ]);

  const findings = auditClpMoneyRecords([
    group("CatalogItem", catalog, [decimalField("cost"), decimalField("price")]),
    group("Quotation", quotations, [
      decimalField("subtotal"), decimalField("discountTotal"), decimalField("taxTotal"), decimalField("total")
    ]),
    group("QuotationItem", quotationItems, [
      decimalField("unitPrice"),
      { name: "discountValue", value: (record) => record.discountType === "FIXED" ? record.discountValue : null },
      decimalField("subtotal"), decimalField("discountTotal"), decimalField("taxTotal"), decimalField("total")
    ]),
    group("Event", events, [decimalField("budget")]),
    group("EventResource", eventResources, [decimalField("unitCost")]),
    group("Payment", payments, [decimalField("amount")]),
    group("PaymentRefund", refunds, [decimalField("amount")]),
    group("PaymentReceipt", receipts, [{ name: "metadata.amount", value: receiptAmount }]),
    group("ProviderProfile", profiles, [decimalField("price")])
  ]);

  if (findings.length > 0) {
    console.error("CLP MONEY PRECISION FAILED");
    findings.forEach((finding) => console.error(`- ${finding.table} ${finding.id} ${finding.field}`));
    process.exitCode = 1;
  } else {
    console.log("CLP MONEY PRECISION PASSED");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "No fue posible auditar la precisión monetaria.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

function group(table, records, fields) {
  return { table, records, fields };
}

function decimalField(name) {
  return { name, value: (record) => record[name]?.toString() ?? null };
}

function receiptAmount(record) {
  if (typeof record.metadata !== "object" || record.metadata === null || Array.isArray(record.metadata)) return null;
  const amount = record.metadata.amount;
  return typeof amount === "string" || typeof amount === "number" ? amount : null;
}
