import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { readProductIntegrationsConfig } from "../dist/index.js";

// Random hex, not a repeated pattern — assertCryptographicSecret rejects
// low-diversity/repeated values (e.g. "a".repeat(64)) even at 64+ chars.
const SECRET = "da0a6545d0019570aca8984cb98cfba9574d840b981613d1e1276e4a8ddfed0b";

function productionEnv(overrides = {}) {
  return {
    NODE_ENV: "production",
    WHATSAPP_HASH_SECRET: SECRET,
    PAYMENT_SANDBOX_SECRET: SECRET,
    ...overrides
  };
}

test("production rejects PAYMENT_GATEWAY=sandbox", () => {
  assert.throws(() => readProductIntegrationsConfig(productionEnv({ PAYMENT_GATEWAY: "sandbox" })), {
    message: "PAYMENT_GATEWAY must not be sandbox in production"
  });
});

test("production boots with PAYMENT_GATEWAY unset, defaulting to disabled", () => {
  const config = readProductIntegrationsConfig(productionEnv());
  assert.equal(config.paymentGateway, "disabled");
});

test("production boots explicitly with PAYMENT_GATEWAY=disabled", () => {
  const config = readProductIntegrationsConfig(productionEnv({ PAYMENT_GATEWAY: "disabled" }));
  assert.equal(config.paymentGateway, "disabled");
});

test("the production environment contract keeps payments disabled while non-production defaults to sandbox", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../../../docs/configuration/environment-variables.json", import.meta.url), "utf8")
  );
  const paymentGateway = manifest.variables.find((variable) => variable.name === "PAYMENT_GATEWAY");
  const productionExample = readFileSync(new URL("../../../.env.production.example", import.meta.url), "utf8");

  assert.equal(paymentGateway.default, "sandbox");
  assert.equal(paymentGateway.productionValue, "disabled");
  assert.match(productionExample, /^PAYMENT_GATEWAY=disabled$/m);
  assert.doesNotMatch(productionExample, /^PAYMENT_GATEWAY=sandbox$/m);
});

test("production accepts PAYMENT_GATEWAY=provider at the config layer (adapter registration is enforced at bootstrap, not here)", () => {
  const config = readProductIntegrationsConfig(productionEnv({ PAYMENT_GATEWAY: "provider" }));
  assert.equal(config.paymentGateway, "provider");
});

test("development and test default to PAYMENT_GATEWAY=sandbox", () => {
  assert.equal(readProductIntegrationsConfig({ NODE_ENV: "development" }).paymentGateway, "sandbox");
  assert.equal(readProductIntegrationsConfig({ NODE_ENV: "test" }).paymentGateway, "sandbox");
});

test("development and test accept an explicit PAYMENT_GATEWAY=sandbox", () => {
  const config = readProductIntegrationsConfig({ NODE_ENV: "test", PAYMENT_GATEWAY: "sandbox" });
  assert.equal(config.paymentGateway, "sandbox");
});

test("rejects an unknown PAYMENT_GATEWAY value in any environment", () => {
  assert.throws(() => readProductIntegrationsConfig({ NODE_ENV: "test", PAYMENT_GATEWAY: "stripe" }), {
    message: "PAYMENT_GATEWAY must be disabled, sandbox, or provider"
  });
});

test("never silently coerces an invalid WHATSAPP_MODE into manual or provider", () => {
  assert.throws(() => readProductIntegrationsConfig({ NODE_ENV: "test", WHATSAPP_MODE: "auto" }), {
    message: "WHATSAPP_MODE must be manual or provider"
  });
});

test("WHATSAPP_MODE=manual and WHATSAPP_MODE=provider both remain available in every environment", () => {
  assert.equal(readProductIntegrationsConfig({ NODE_ENV: "test", WHATSAPP_MODE: "manual" }).whatsappMode, "manual");
  assert.equal(readProductIntegrationsConfig({ NODE_ENV: "test", WHATSAPP_MODE: "provider" }).whatsappMode, "provider");
  assert.equal(
    readProductIntegrationsConfig(productionEnv({ WHATSAPP_MODE: "provider" })).whatsappMode,
    "provider"
  );
});
