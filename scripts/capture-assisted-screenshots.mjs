#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { chromium, request } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const webBase = process.env.E2E_WEB_BASE_URL ?? "http://localhost:4200";
const apiBase = process.env.E2E_API_BASE_URL ?? "http://localhost:3000";
const output = "docs/design/screenshots";
const demoEmail = "empresa.angela@demo.kaklen.local";
const demoPassword = "KaklenDemo2026!";
const temporaryEmail = "assisted.screenshots@demo.kaklen.local";
const temporaryPassword = "KaklenScreenshots2026!";
const prisma = new PrismaClient();

await mkdir(output, { recursive: true });
await clearTemporaryAccount();

const browser = await chromium.launch({ headless: true });
try {
  const demoContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const demoPage = await demoContext.newPage();
  await login(demoPage, demoEmail, demoPassword);
  const organizationId = await demoPage.evaluate(() => localStorage.getItem("kaklen.activeOrganizationId"));
  if (!organizationId) throw new Error("Demo organization was not activated");

  await capture(demoPage, `/organizations/${organizationId}`, "assisted-dashboard-data.png");
  await demoPage.getByRole("button", { name: "Ver detalles" }).click();
  await captureCurrent(demoPage, "assisted-onboarding.png");
  await demoPage.keyboard.press("Control+K");
  await demoPage.getByRole("dialog").waitFor();
  await assertDialogFitsViewport(demoPage);
  await captureCurrent(demoPage, "assisted-command-palette.png");
  await demoPage.getByRole("dialog").getByRole("searchbox").fill("comercial");
  await demoPage.getByRole("dialog").locator(".search-result").first().waitFor();
  await captureCurrent(demoPage, "assisted-global-search.png");
  await demoPage.keyboard.press("Escape");

  await capture(demoPage, `/organizations/${organizationId}/clients/new`, "assisted-client-wizard.png");
  await capture(demoPage, `/organizations/${organizationId}/quotations/new`, "assisted-quotation-wizard.png");
  await capture(demoPage, `/organizations/${organizationId}/events/new`, "assisted-event-wizard.png");

  await navigateSpa(demoPage, `/organizations/${organizationId}/clients`);
  const clientHref = await demoPage.locator(`a[href*="/organizations/${organizationId}/clients/"]`).filter({ hasNotText: "Nuevo cliente" }).first().getAttribute("href");
  if (!clientHref) throw new Error("Demo client route was not found");
  await captureRoute(demoPage, clientHref.replace(/^\/es/, ""), "assisted-client-timeline.png");
  await navigateSpa(demoPage, `/organizations/${organizationId}`);
  await demoPage.locator(".recent-activity-panel").scrollIntoViewIfNeeded();
  await captureCurrent(demoPage, "assisted-recent-activity.png");

  await demoPage.setViewportSize({ width: 390, height: 844 });
  await settleViewport(demoPage);
  await capture(demoPage, `/organizations/${organizationId}`, "mobile-assisted-dashboard.png");
  await demoPage.getByRole("button", { name: "Abrir perfil" }).click();
  await demoPage.getByRole("button", { name: "Buscar o ir a..." }).click();
  await demoPage.getByRole("dialog").waitFor();
  await assertDialogFitsViewport(demoPage);
  await demoPage.getByRole("dialog").getByRole("searchbox").fill("comercial");
  await demoPage.getByRole("dialog").locator(".search-result").first().waitFor();
  await captureCurrent(demoPage, "mobile-assisted-search.png");
  await demoPage.keyboard.press("Escape");
  await capture(demoPage, `/organizations/${organizationId}/quotations/new`, "mobile-assisted-quotation-wizard.png");
  await capture(demoPage, `/organizations/${organizationId}/events/new`, "mobile-assisted-event.png");
  await demoContext.close();

  const temporary = await createTemporaryOrganization();
  const emptyContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const emptyPage = await emptyContext.newPage();
  await login(emptyPage, temporaryEmail, temporaryPassword);
  await capture(emptyPage, `/organizations/${temporary.organizationId}`, "assisted-dashboard-new.png");
  await navigateSpa(emptyPage, `/organizations/${temporary.organizationId}/clients`);
  await emptyPage.locator("kaklen-empty-state").waitFor();
  await captureCurrent(emptyPage, "assisted-empty-state.png");
  await emptyPage.setViewportSize({ width: 390, height: 844 });
  await settleViewport(emptyPage);
  await capture(emptyPage, `/organizations/${temporary.organizationId}`, "mobile-assisted-onboarding.png");
  await emptyContext.close();

  console.log("✓ 16 assisted-product screenshots captured");
} finally {
  await browser.close();
  await clearTemporaryAccount();
  await prisma.$disconnect();
}

async function createTemporaryOrganization() {
  const api = await request.newContext({ baseURL: apiBase, extraHTTPHeaders: { Origin: webBase } });
  const register = await api.post("/api/auth/register", { data: { email: temporaryEmail, firstName: "Auditoría", lastName: "Visual", password: temporaryPassword } });
  if (register.status() !== 201) throw new Error(`Temporary registration failed with ${register.status()}`);
  const token = (await register.json()).accessToken;
  const organization = await api.post("/api/organizations", {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: "Espacio nuevo de demostración" }
  });
  if (organization.status() !== 201) throw new Error(`Temporary organization failed with ${organization.status()}`);
  const body = await organization.json();
  await api.dispose();
  return { organizationId: body.id };
}

async function clearTemporaryAccount() {
  const user = await prisma.user.findUnique({ where: { email: temporaryEmail }, select: { id: true } });
  if (!user) return;
  await prisma.organization.deleteMany({ where: { createdByUserId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

async function login(page, email, password) {
  await page.goto(`${webBase}/es/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/es\/dashboard$/);
  await page.waitForFunction(() => localStorage.getItem("kaklen.activeOrganizationId") !== null);
}

async function capture(page, route, filename) {
  await captureRoute(page, route, filename);
}

async function captureRoute(page, route, filename) {
  await navigateSpa(page, route);
  await page.locator("main").last().waitFor();
  await page.locator(".dashboard-skeleton").waitFor({ state: "hidden" });
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector(".app-content")?.scrollTo(0, 0);
  });
  await settleViewport(page);
  await captureCurrent(page, filename);
}

async function captureCurrent(page, filename) {
  await page.screenshot({ path: `${output}/${filename}`, fullPage: false });
  console.log(`✓ ${filename}`);
}

async function navigateSpa(page, route) {
  const localizedRoute = `/es${route}`;
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, localizedRoute);
  await page.waitForURL((url) => `${url.pathname}${url.search}` === localizedRoute);
}

async function settleViewport(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );
}

async function assertDialogFitsViewport(page) {
  const bounds = await page.getByRole("dialog").boundingBox();
  const backdrop = await page.locator(".command-backdrop").boundingBox();
  const viewport = page.viewportSize();
  if (!bounds || !backdrop || !viewport || bounds.y < 0 || bounds.y + bounds.height > viewport.height || backdrop.height < viewport.height) {
    throw new Error("Command palette does not fit inside the current viewport");
  }
}
